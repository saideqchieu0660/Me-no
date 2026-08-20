import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { store, Flashcard, Deck } from "../lib/store";
import { CardStateManager } from "../lib/CardStateManager";
import localforage from "localforage";
import {
  getOfflineDeck,
  saveDeckOffline,
  deleteOfflineDeck,
  isDeckSavedOffline,
} from "../utils/offlineDb";
import {
  Check,
  X,
  RefreshCcw,
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Edit3,
  Sparkles,
  Volume2,
  VolumeX,
  Type,
  Pin,
  PinOff,
  Minimize2,
  Maximize2,
  Play,
  Pause,
  Clock,
  BellPlus,
  Trash2,
  Plus,
  AlertCircle,
  BarChart3,
  Activity as ActivityIcon,
  Download,
  Bot,
  Network,
  Eye,
  Share2,
  Copy,
  CheckCheck,
  FileText,
  BookOpen,
  CloudUpload,
} from "lucide-react";
import { DiffViewer } from "../components/DiffViewer";
import {
  playFlipSound,
  playCorrectSound,
  playIncorrectSound,
  toggleMute,
  getIsMuted,
  initAudio,
} from "../lib/audio";
import { cn } from "../lib/utils";
import { safeRequest } from "../utils/apiClient";
import { useAICooldown } from "../lib/cooldown";
import { isFeatureEnabled } from "../features.config";
import { VibeFlashcardActiveView } from "../vibe-sandbox/VibeFlashcardActiveView";
import { VibeClassModal } from "../vibe-sandbox/VibeClassModal";
import { EditDeckModal } from "../components/EditDeckModal";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { motion } from "motion/react";
import { triggerCelebration } from "../lib/celebration";
import { v4 as uuidv4 } from "uuid";
import { db, auth, FirebaseListenerManager } from "../lib/firebase";
import {
  doc,
  onSnapshot,
  collection,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

const MOTIVATION_QUOTES = [
  "It is not because things are difficult that we do not dare; it is because we do not dare that they are difficult. - Seneca",
  "The impediment to action advances action. What stands in the way becomes the way. - Marcus Aurelius",
  "You have power over your mind - not outside events. - Marcus Aurelius",
  "Luck is what happens when preparation meets opportunity. - Seneca",
];

// Confetti component removed

import { useSoundContext } from "../components/SoundProvider";
import { VirtualizedFlashcardList } from "../components/VirtualizedFlashcardList";
import { useTheme } from "../components/ThemeProvider";
import { ConfirmModal } from "../components/ConfirmModal";

export function detectLanguage(text: string): {
  isAvailable: boolean;
  locale: "en-US" | "vi-VN" | "";
} {
  if (!text) return { isAvailable: false, locale: "" };

  // Clean up code/LaTeX/symbols and Markdown markers
  const clean = text
    .replace(/\$\$[\s\S]*?\$\$/g, "")
    .replace(/\$[\s\S]*?\$/g, "")
    .replace(/[*_#`\\[\]]/g, "")
    .trim();

  if (!clean) return { isAvailable: false, locale: "" };

  // Check if there are any alphabet letters
  const hasLetters =
    /[a-zA-Záàảãạâấầẩẫậăắằẳẵặéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ]/i.test(
      clean,
    );
  if (!hasLetters) return { isAvailable: false, locale: "" };

  // Check for foreign scripts we do not support
  const hasOtherScripts =
    /[\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u0400-\u04ff]/i.test(
      clean,
    );
  if (hasOtherScripts) return { isAvailable: false, locale: "" };

  // Vietnamese diacritics
  const hasViDiacritics =
    /[áàảãạâấầẩẫậăắằẳẵặéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ]/i.test(
      clean,
    );
  if (hasViDiacritics) {
    return { isAvailable: true, locale: "vi-VN" };
  }

  // English letters
  const hasEnLetters = /[a-zA-Z]/.test(clean);
  if (hasEnLetters) {
    return { isAvailable: true, locale: "en-US" };
  }

  return { isAvailable: false, locale: "" };
}

import remarkBreaks from "remark-breaks";
import { VibeProgressSyncManager } from "./sync/VibeProgressSyncManager";

const ParsedTextContent = ({ text }: { text: string }) => {
  if (!text) return <span className="opacity-50">Chưa có nội dung</span>;

  return (
    <div className="markdown-body prose dark:prose-invert max-w-none w-full text-left break-words whitespace-pre-wrap">
      <ReactMarkdown remarkPlugins={[remarkMath, remarkBreaks]} rehypePlugins={[rehypeKatex]}>
        {text}
      </ReactMarkdown>
    </div>
  );
};

export default function VibeStudyRoom() {
  const navigate = useNavigate();
  const { isFixLagEnabled } = useTheme();
  const { isSoundEnabled, toggleSound } = useSoundContext();
  useEffect(() => {
    document.title = "Henosis - Study Room";
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }
  }, []);

  const user = store.getCurrentUser();
  const isAdminMode =
    sessionStorage.getItem("isAdminMode") !== "false" &&
    (user?.role === "admin" ||
      user?.role === "Admin" ||
      user?.role === "teacher");
  const homePath = isAdminMode ? "/teacher" : "/dashboard";

  const { cooldownRemaining, startCooldown } = useAICooldown(user);
  const { deckId: rawDeckId } = useParams();
  const deckId = rawDeckId ? decodeURIComponent(rawDeckId) : "";
  const handleBack = async (e?: React.MouseEvent) => {
    if (user?.id && deckId) {
      import("./sync/VibeProgressSyncManager").then(m => m.VibeProgressSyncManager.finishAndSyncSession(user.id, deckId)).catch(() => {});
    }
    if (e) e.preventDefault();
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(homePath);
    }
  };
  const [isLoading, setIsLoading] = useState(true);
  const [rawDeck, setRawDeck] = useState<any>(() => store.getDeck(deckId));
  const [personalCardStates, setPersonalCardStates] = useState<any[]>([]);

  useEffect(() => {
    const handleLocalStateUpdate = (e: any) => {
      if (e.detail && e.detail.states) {
        setPersonalCardStates(prev => {
          const next = [...prev];
          e.detail.states.forEach((s: any) => {
            const idx = next.findIndex(p => p.id === s.cardId);
            if (idx >= 0) {
              next[idx] = { ...next[idx], isWeakCard: s.isWeakCard, updatedAt: Date.now() };
            } else {
              next.push({ id: s.cardId, isWeakCard: s.isWeakCard, updatedAt: Date.now() });
            }
          });
          return next;
        });
      }
    };
    window.addEventListener("vibe-card-states-updated", handleLocalStateUpdate);
    
    const handleBackupRestored = () => {
      setSessionHistory([]);
      setSessionMasteryGained(0);
      setSessionTimeSpent(0);
    };
    window.addEventListener("vibe-backup-restored", handleBackupRestored);

    return () => {
      window.removeEventListener("vibe-card-states-updated", handleLocalStateUpdate);
      window.removeEventListener("vibe-backup-restored", handleBackupRestored);
    };
  }, []);

  const [accessDenied, setAccessDenied] = useState(false);
  const [isOfflineSaved, setIsOfflineSaved] = useState(false);

  // Quick Notes Scratchpad states
  const [scratchpadText, setScratchpadText] = useState("");
  const [isNotesSaving, setIsNotesSaving] = useState(false);
  const [lastNotesSavedTime, setLastNotesSavedTime] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const handleSync = () => {
      if (deckId) {
        setRawDeck(store.getDeck(deckId));
      }
    };
    window.addEventListener("henosis-data-synced", handleSync);
    return () => window.removeEventListener("henosis-data-synced", handleSync);
  }, [deckId]);

  // 1. Listen to raw deck structure in real-time
  const unsubDeckRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    setIsLoading(true);
    if (!deckId) {
      setIsLoading(false);
      return;
    }

    // Try loading immediately from local store memory first so screen displays without delay
    const initialDeck = store.getDeck(deckId);
    if (initialDeck) {
      setRawDeck(initialDeck);
      setIsLoading(false);
    }

    // Check offline saved state and load immediately if offline
    isDeckSavedOffline(deckId).then(setIsOfflineSaved);

    if (!navigator.onLine) {
      if (deckId === "daily-quest") {
        localforage.getItem("cached_roadmap").then((cachedRoadmap) => {
          if (cachedRoadmap && Array.isArray(cachedRoadmap)) {
            toast("Mạng ngoại tuyến, hiển thị lộ trình tuyến Offline PWA.");
            const dailyDeck = {
              id: "daily-quest",
              title: "Nhiệm vụ hôm nay (Daily Quest)",
              subject: "Spaced Repetition",
              description:
                "Được tự động tạo bởi SM-2 bằng Thuật toán phân cực.",
              cards: cachedRoadmap,
              createdAt: new Date().toISOString(),
              ownerId: "system",
            };
            setRawDeck(dailyDeck);
            store.setTempDeck(dailyDeck);
          } else {
            toast("Không có lộ trình ngoại tuyến nào khả dụng.");
            navigate(
              user?.role === "teacher"
                ? "/teacher"
                : "/dashboard",
            );
          }
          setIsLoading(false);
        });
      } else {
        getOfflineDeck(deckId).then((offlineDeck) => {
          if (offlineDeck) {
            console.log("Loaded offline deck from DB:", offlineDeck);
            setRawDeck(offlineDeck);
            store.setTempDeck(offlineDeck);
            setIsOfflineSaved(true);
          } else if (initialDeck) {
            setRawDeck(initialDeck);
          }
          setIsLoading(false);
        });
      }
      return;
    }

    // Transient frontend decks bypass server fetch
    if (deckId === "daily-quest" || deckId === "remind-later-deck") {
      const localTransient = store.getDeck(deckId);
      if (localTransient) {
        setRawDeck(localTransient);
        setIsLoading(false);
      } else if (deckId === "daily-quest") {
        // Auto-generate daily-quest
        const buildDailyQuest = async () => {
          try {
            const safeRequest = (await import("../utils/apiClient"))
              .safeRequest;
            // OPTIMIZATION: Avoid full table scan by using locally cached decks from store
            const allLocalDecks = store.getDecks();
            const allCards: any[] = [];
            allLocalDecks.forEach((data) => {
              if (data && Array.isArray(data.cards)) {
                  data.cards.forEach((c: any) => {
                    allCards.push({
                      ...c,
                      originDeckId: data.id,
                      originDeckTitle: data.title,
                    });
                  });
              }
            });
            
            const homePath =
              user?.role === "teacher"
                ? "/teacher"
                : "/dashboard";

            if (allCards.length === 0) {
              navigate(homePath);
              setIsLoading(false);
              return;
            }

            const res = await safeRequest("/api/daily-quest", {
              headers: { "Content-Type": "application/json" },
              method: "POST",
              body: JSON.stringify({ allCards }),
            });
            const reqData = await res.json();

            if (!reqData.cards || reqData.cards.length === 0) {
              navigate(homePath);
              setIsLoading(false);
              return;
            }

            // CACHE ROADMAP
            await localforage
              .setItem("cached_roadmap", reqData.cards)
              .catch(console.warn);

            const dailyDeck = {
              id: "daily-quest",
              title: "Nhiệm vụ hôm nay (Daily Quest)",
              subject: "Spaced Repetition",
              description:
                "Được tự động tạo bởi SM-2 bằng Thuật toán phân cực.",
              cards: reqData.cards,
              createdAt: new Date().toISOString(),
              ownerId: "system",
            };

            store.setTempDeck(dailyDeck);
            setRawDeck(dailyDeck);
            setIsLoading(false);
          } catch (e) {
            console.error("Auto daily quest generation failed:", e);
            const homePath =
              user?.role === "teacher"
                ? "/teacher"
                : "/dashboard";

            // Fallback on Catch: If network failed unexpectedly during fetch
            try {
              const cachedRoadmap = await localforage.getItem("cached_roadmap");
              if (cachedRoadmap && Array.isArray(cachedRoadmap)) {
                toast(
                  "Mạng không ổn định. Kích hoạt dự phòng lộ trình Offline.",
                );
                const dailyDeck = {
                  id: "daily-quest",
                  title: "Nhiệm vụ hôm nay (Daily Quest)",
                  subject: "Spaced Repetition",
                  description:
                    "Được tự động tạo bởi SM-2 bằng Thuật toán phân cực.",
                  cards: cachedRoadmap,
                  createdAt: new Date().toISOString(),
                  ownerId: "system",
                };
                store.setTempDeck(dailyDeck);
                setRawDeck(dailyDeck);
                setIsLoading(false);
                return;
              }
            } catch (fallbackErr) {}

            navigate(homePath);
            setIsLoading(false);
          }
        };
        buildDailyQuest();
      } else if (deckId === "remind-later-deck") {
        const homePath =
          user?.role === "teacher"
            ? "/teacher"
            : "/dashboard";
        navigate(homePath);
        setIsLoading(false);
      }
      return;
    }

    let unsubAuth: any = null;

    const setupAuthAndListen = () => {
      unsubAuth = import("firebase/auth").then(({ onAuthStateChanged }) => {
        return onAuthStateChanged(auth, () => {
          if (unsubDeckRef.current) {
            unsubDeckRef.current();
          }

          try {
            const unsub = onSnapshot(
              doc(db, "sets", deckId),
              (docSnap) => {
                if (docSnap.exists()) {
                  const fetchedData = docSnap.data();
                  if (fetchedData && !fetchedData.id)
                    fetchedData.id = docSnap.id;
                  setRawDeck(fetchedData);
                  store.setTempDeck(fetchedData);
                } else {
                  // Fallback to IndexedDB / local store if document does not exist
                  getOfflineDeck(deckId).then((offlineDeck) => {
                    if (offlineDeck) {
                      setRawDeck(offlineDeck);
                      store.setTempDeck(offlineDeck);
                      setIsOfflineSaved(true);
                    } else {
                      const localDeck = store.getDeck(deckId);
                      if (localDeck) {
                        setRawDeck(localDeck);
                      }
                    }
                  });
                }
                setIsLoading(false);
              },
              (err) => {
                console.warn(
                  "onSnapshot failed, falling back to local database:",
                  err,
                );
                getOfflineDeck(deckId).then((offlineDeck) => {
                  if (offlineDeck) {
                    setRawDeck(offlineDeck);
                    store.setTempDeck(offlineDeck);
                    setIsOfflineSaved(true);
                  } else {
                    const localDeck = store.getDeck(deckId);
                    if (localDeck) {
                      setRawDeck(localDeck);
                    }
                  }
                  setIsLoading(false);
                });
              }
            );
            unsubDeckRef.current = unsub;
            FirebaseListenerManager.add(`StudyRoom_deck_${deckId}`, unsub);
          } catch (e) {
            console.error("Failed to sync room deck in real-time:", e);
            const localDeck = store.getDeck(deckId);
            if (localDeck) {
              setRawDeck(localDeck);
            }
            setIsLoading(false);
          }
        });
      });
    };

    setupAuthAndListen();

    return () => {
      if (unsubDeckRef.current) {
        unsubDeckRef.current();
        unsubDeckRef.current = null;
      }
      FirebaseListenerManager.remove(`StudyRoom_deck_${deckId}`);
      if (unsubAuth) {
        unsubAuth.then((unsub: any) => {
          if (unsub) unsub();
        });
      }
    };
  }, [deckId, user?.id]);

  useEffect(() => {
    if (rawDeck && user) {
      setAccessDenied(false);
    }
  }, [rawDeck?.id, user?.id]);

  // 2. Load personal card states ONCE to save reads instead of real-time onSnapshot
  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    let unsubAuthStates: any = null;

    unsubAuthStates = import("firebase/auth").then(({ onAuthStateChanged }) => {
      return onAuthStateChanged(auth, async () => {
        try {
          await CardStateManager.hydrateStates(user.id);
          const states = CardStateManager.getAllStates(user.id).map(s => ({
            id: s.cardId,
            mastery: s.mastery,
            isWeakCard: s.isHard,
            nextReviewDate: s.nextReviewDate,
            updatedAt: s.updatedAt || Date.now()
          }));
          
          if (isMounted) {
            setPersonalCardStates(states);
          }
        } catch (e) {
          console.error("Failed to fetch study room card states:", e);
        }
      });
    });

    return () => {
      isMounted = false;
      if (unsubAuthStates) {
        unsubAuthStates.then((unsub: any) => {
          if (unsub) unsub();
        });
      }
    };
  }, [user?.id]);

  // Handle cross-tab/cross-component state updates from VibeSyncEngine or other sources
  useEffect(() => {
    const handleStatesUpdated = (e: any) => {
      const newStates = e.detail?.states || [];
      if (newStates.length === 0) return;
      
      setPersonalCardStates(prev => {
        const next = [...prev];
        let hasChanges = false;
        
        for (const newState of newStates) {
           const existingIdx = next.findIndex(s => s.id === newState.cardId);
           if (existingIdx >= 0) {
              if (newState.updatedAt && next[existingIdx].updatedAt && newState.updatedAt <= next[existingIdx].updatedAt) {
                 continue; // Skip if older
              }
              next[existingIdx] = { ...next[existingIdx], ...newState, id: newState.cardId };
              hasChanges = true;
           } else {
              next.push({ ...newState, id: newState.cardId });
              hasChanges = true;
           }
        }
        
        return hasChanges ? next : prev;
      });
    };

    window.addEventListener("vibe-card-states-updated", handleStatesUpdated);
    return () => {
      window.removeEventListener("vibe-card-states-updated", handleStatesUpdated);
    };
  }, []);

  // 3. Merge raw deck and personal card states to form reactive deck
  const deck = useMemo(() => {
    if (!rawDeck) return null;
    const stateMap = new Map();
    if (personalCardStates && personalCardStates.length > 0) {
      personalCardStates.forEach((s) => stateMap.set(s.id, s));
    }

    const getCardTimestamp = (obj: any): number => {
      if (!obj) return 0;
      let ts = 0;
      if (typeof obj.lastUpdatedAt === 'number') ts = Math.max(ts, obj.lastUpdatedAt);
      if (typeof obj.updatedAt === 'string') {
          const parsed = new Date(obj.updatedAt).getTime();
          if (!isNaN(parsed)) ts = Math.max(ts, parsed);
      } else if (typeof obj.updatedAt === 'number') {
          ts = Math.max(ts, obj.updatedAt);
      }
      return ts;
    };

    const mergedDeck = { ...rawDeck };
    if (mergedDeck.cards) {
      mergedDeck.cards = mergedDeck.cards.map((card: any) => {
        const savedState = stateMap.get(card.id);
        if (savedState) {
          const cardTs = getCardTimestamp(card);
          const savedTs = getCardTimestamp(savedState);
          
          if (savedTs >= cardTs) {
            return {
              ...card,
              mastery:
                typeof savedState.mastery === "number"
                  ? savedState.mastery
                  : card.mastery,
              nextReview:
                typeof savedState.nextReview === "number"
                  ? savedState.nextReview
                  : card.nextReview,
              interval:
                typeof savedState.interval === "number"
                  ? savedState.interval
                  : card.interval,
              repetition:
                typeof savedState.repetition === "number"
                  ? savedState.repetition
                  : card.repetition,
              efactor:
                typeof savedState.efactor === "number"
                  ? savedState.efactor
                  : card.efactor,
              isHard:
                typeof savedState.isWeakCard !== "undefined"
                  ? savedState.isWeakCard
                  : card.isHard,
              updatedAt: savedState.updatedAt || card.updatedAt
            };
          }
        }
        return card;
      });
    }

    // Attempt to silently update global store locally in background
    setTimeout(async () => {
      try {
        const { store: globalStore } = await import("../lib/store");
        const currentDecks = [...globalStore.getDecks()];
        const existIdx = currentDecks.findIndex((d) => d.id === mergedDeck.id);
        if (existIdx >= 0) {
          currentDecks[existIdx] = mergedDeck;
          if (typeof (globalStore as any).setDecksLocally === "function") {
            (globalStore as any).setDecksLocally(currentDecks);
          }
        }
      } catch (e) {
        // ignore
      }
    }, 0);

    return mergedDeck;
  }, [rawDeck, personalCardStates]);

  // Load scratchpad from Firestore, fallback to Local Storage
  useEffect(() => {
    if (!user || !deckId) return;

    const localKey = `scratchpad_${user.id}_${deckId}`;
    const localContent = localStorage.getItem(localKey) || "";
    setScratchpadText(localContent);

    const loadNotes = async () => {
      try {
        const docRef = doc(db, "users", user.id, "scratchpads", deckId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const cloudContent = docSnap.data().content || "";
          setScratchpadText(cloudContent);
          localStorage.setItem(localKey, cloudContent);
        }
      } catch (err: any) {
        if (!navigator.onLine || err?.message?.includes("offline")) {
          console.warn("Ghi chú nhanh đang sử dụng bộ nhớ tạm cục bộ (offline).");
        } else {
          console.warn("Lỗi khi tải ghi chú nhanh:", err);
        }
      }
    };

    if (navigator.onLine) {
      loadNotes();
    }
  }, [deckId, user?.id]);

  // Debounce Auto-Save scratchpad to Firestore & Local Storage
  useEffect(() => {
    if (!user || !deckId) return;

    const localKey = `scratchpad_${user.id}_${deckId}`;
    const cached = localStorage.getItem(localKey) || "";
    if (scratchpadText === cached) {
      return;
    }

    localStorage.setItem(localKey, scratchpadText);

    const timer = setTimeout(async () => {
      setIsNotesSaving(true);
      try {
        const docRef = doc(db, "users", user.id, "scratchpads", deckId);
        await setDoc(
          docRef,
          {
            content: scratchpadText,
            updatedAt: new Date().toISOString(),
            deckId: deckId,
            deckTitle: deck?.title || "Sổ tay phòng học",
          },
          { merge: true },
        );

        const now = new Date();
        const timeStr = now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        setLastNotesSavedTime(timeStr);
      } catch (err: any) {
        if (!navigator.onLine || err?.message?.includes("offline")) {
          console.warn("Ghi chú nhanh đã lưu vào bộ nhớ tạm cục bộ (chờ kết nối lại).");
        } else {
          console.warn("Lỗi tự động lưu ghi chú:", err);
        }
      } finally {
        setIsNotesSaving(false);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [scratchpadText, deckId, user?.id, deck?.title]);

  // Handle network reconnect with throttle
  useEffect(() => {
    let reconnectThrottle: NodeJS.Timeout | null = null;

    const handleReconnect = () => {
      if (reconnectThrottle) return;

      console.log(
        "[StudyRoom] Network reconnect detected. Ensuring state freshness...",
      );
      // onSnapshot automatically refreshes under the hood thanks to enableNetwork.
      // We can reset isLoading here if the view got stuck
      if (
        isLoading &&
        deckId &&
        deckId !== "daily-quest" &&
        deckId !== "remind-later-deck"
      ) {
        console.log(
          "[StudyRoom] Forced loading state bypass to revive stalled UI",
        );
        // It might take a moment for onSnapshot to fire, but we mark it as attempting reconnect
      }

      reconnectThrottle = setTimeout(() => {
        reconnectThrottle = null;
      }, 15000); // 15s throttle
    };

    window.addEventListener("app-network-reconnect", handleReconnect);

    return () => {
      window.removeEventListener("app-network-reconnect", handleReconnect);
      if (reconnectThrottle) clearTimeout(reconnectThrottle);
    };
  }, [isLoading, deckId]);

  const [studyQueue, setStudyQueue] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isClozeMode, setIsClozeMode] = useState(() => {
    return localStorage.getItem("study_cloze_mode") === "true";
  });
  const [isHintRevealed, setIsHintRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    if (finished && user?.id && deckId) {
      import("./sync/VibeProgressSyncManager").then(m => m.VibeProgressSyncManager.finishAndSyncSession(user.id, deckId)).catch(() => {});
    }
  }, [finished, user?.id, deckId]);

  const [isListModalOpen, setIsListModalOpen] = useState(false);
  const [listSearchQuery, setListSearchQuery] = useState("");
  const [isGeneratingCloze, setIsGeneratingCloze] = useState(false);

  useEffect(() => {
    if (finished) {
      triggerCelebration();
      if (deck) {
        const progressKey = `study_progress_${user?.id || "guest"}_${deck.id}`;
        localStorage.setItem(progressKey, "0");
        VibeProgressSyncManager.markLocalUpdate(user?.id || "guest", deck.id);
      }
    }
  }, [finished, deck?.id, user?.id]);
  const [sessionMasteryGained, setSessionMasteryGained] = useState(0);
  const [sessionStartTime] = useState(() => Date.now());
  const [sessionTimeSpent, setSessionTimeSpent] = useState(0);
  const [sessionHistory, setSessionHistory] = useState<
    Array<{
      cardId?: string;
      cardIndex: number;
      front: string;
      status: "correct" | "incorrect" | "skipped";
      cumulativeCorrect: number;
      cumulativeStudied: number;
      accuracy: number;
      masteryChange: number;
    }>
  >([]);
  const uniqueHistoryMap = new Map();
  sessionHistory.forEach(h => {
    uniqueHistoryMap.set(h.cardId || h.cardIndex, h);
  });
  const uniqueHistory = Array.from(uniqueHistoryMap.values());
  const sessionCorrectCount = uniqueHistory.filter(h => h.status === "correct").length;
  const sessionIncorrectCount = uniqueHistory.filter(h => h.status === "incorrect").length;

  const [isClassModalOpen, setIsClassModalOpen] = useState(false);
  const [isEditDeckModalOpen, setIsEditDeckModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isTranslatingDefinition, setIsTranslatingDefinition] = useState(false);
  const [confirmTranslateCardId, setConfirmTranslateCardId] = useState<string | null>(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");
  const [editExampleSentence, setEditExampleSentence] = useState("");
  const [isUpdatingCard, setIsUpdatingCard] = useState(false);
  const [editSuccessMessage, setEditSuccessMessage] = useState<string | null>(
    null,
  );

  const [deleteCountdown, setDeleteCountdown] = useState<number | null>(null);
  const deleteTimerRef = useRef<NodeJS.Timeout | null>(null);

  const cancelDeleteCountdown = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (deleteTimerRef.current) {
      clearInterval(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
    setDeleteCountdown(null);
  }, []);

  useEffect(() => {
    if (!isEditing) {
      cancelDeleteCountdown();
    }
  }, [isEditing, cancelDeleteCountdown]);


  const [deckEditTitle, setDeckEditTitle] = useState("");
  const [deckEditSubject, setDeckEditSubject] = useState("");
  const [isEditingMetadata, setIsEditingMetadata] = useState(false);
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);
  const [isCreatingNewSubjectDeck, setIsCreatingNewSubjectDeck] =
    useState(false);

  const existingSubjects = useMemo(() => {
    const subjectsSet = new Set<string>();
    store.getDecks().forEach((d) => {
      const s =
        (typeof d.subject === "string"
          ? d.subject
          : JSON.stringify(d.subject)) || "general";
      if (s.trim()) {
        subjectsSet.add(s.trim());
      }
    });
    // Add default core subjects to make sure they are always available as defaults
    const defaults = [
      "general",
      "english",
      "math",
      "science",
      "history",
      "geography",
      "literature",
      "programming",
    ];
    defaults.forEach((def) => subjectsSet.add(def));
    return Array.from(subjectsSet);
  }, []);

  const canEditDeck = useMemo(() => {
    if (!user || !deck) return false;
    const systemDecks = [
      "deck_1",
      "deck_phil_2",
      "deck_math_1",
      "deck_math_2",
      "deck_physics_1",
      "deck_physics_2",
                  "deck_test_ui",
                  "deck_formatting_test",
      "daily-quest",
      "remind-later-deck",
    ];
    const isSystem = systemDecks.includes(deck.id);
    const isAdmin =
      user.role === "admin" || user.role === "Admin" || user.role === "teacher";
    const isCreator = deck.createdBy === user.id;

    if (isSystem) {
      return isAdmin; // Only admin/teacher can edit system/official decks
    }
    return isCreator || isAdmin;
  }, [user?.id, user?.role, deck?.id, deck?.createdBy]);

  useEffect(() => {
    if (deck && !isEditingMetadata) {
      setDeckEditTitle(
        typeof deck.title === "string"
          ? deck.title
          : JSON.stringify(deck.title),
      );
      setDeckEditSubject(
        typeof deck.subject === "string"
          ? deck.subject
          : deck.subject
            ? JSON.stringify(deck.subject)
            : "general",
      );
    }
  }, [deck?.id, deck?.title, deck?.description, deck?.subject, isEditingMetadata]);

  const handleUpdateDeckMetadata = async () => {
    if (!deck || !deckEditTitle.trim() || !canEditDeck) return;
    setIsSavingMetadata(true);
    try {
      const { db } = await import("../lib/firebase");
      const { doc, updateDoc } = await import("firebase/firestore");

      const docRef = doc(db, "sets", deck.id);
      await updateDoc(docRef, {
        title: deckEditTitle.trim(),
        subject: deckEditSubject.trim() || "general",
      });

      // Update locally
      const currentDecks = store.getDecks();
      const existIdx = currentDecks.findIndex((d) => d.id === deck.id);
      if (existIdx >= 0) {
        currentDecks[existIdx].title = deckEditTitle.trim();
        currentDecks[existIdx].subject = deckEditSubject.trim() || "general";
        if (typeof (store as any).setDecksLocally === "function") {
          (store as any).setDecksLocally(currentDecks);
        }
      }

      setEditSuccessMessage("Đã cập nhật thông tin bộ bài thành công!");
      setTimeout(() => setEditSuccessMessage(null), 3000);
      setIsEditingMetadata(false);
    } catch (err) {
      const { handleFirestoreError, OperationType } =
        await import("../lib/firebase");
      handleFirestoreError(err, OperationType.UPDATE, `sets/${deck.id}`);
    } finally {
      setIsSavingMetadata(false);
    }
  };

  const handleToggleMute = () => {
    toggleSound();
  };

  const handleExportDeck = () => {
    if (!deck) return;
    const cleanDeck = {
      title: deck.title,
      subject: deck.subject,
      cards: deck.cards.map((card) => ({
        front: card.front || "",
        back: card.back || "",
      })),
    };
    const blob = new Blob([JSON.stringify(cleanDeck, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${deck.title.replace(/\s+/g, "_").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (deck && isOfflineSaved) {
      saveDeckOffline(deck).catch((e) =>
        console.error("Error backing up updated deck to offline DB:", e),
      );
    }
  }, [deck?.id, deck?.lastUpdatedAt, deck?.cards?.length, isOfflineSaved]);

  const handleToggleOffline = async () => {
    if (!deck) return;
    try {
      if (isOfflineSaved) {
        await deleteOfflineDeck(deck.id);
        setIsOfflineSaved(false);
      } else {
        await saveDeckOffline(deck);
        setIsOfflineSaved(true);
      }
    } catch (e) {
      console.error("Error toggling offline storage:", e);
    }
  };

  const handleFlip = () => {
    if (!isEditing) {
      if (!isFlipped)
        playFlipSound(); // Optionally play sound both on flip and unflip, but just play it
      else playFlipSound();
      setIsFlipped(!isFlipped);
    }
  };

  const [deepExplanation, setDeepExplanation] = useState<string | null>(null);
  const [isCopiedExplanation, setIsCopiedExplanation] = useState(false);
  const [isApplyExplanationModalOpen, setIsApplyExplanationModalOpen] = useState(false);
  const [isApplyingExplanation, setIsApplyingExplanation] = useState(false);
  const [isSerif, setIsSerif] = useState(true);
  const [isPinned, setIsPinned] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [activeAgent, setActiveAgent] = useState<2 | 3>(2);
  const [quote] = useState(
    MOTIVATION_QUOTES[Math.floor(Math.random() * MOTIVATION_QUOTES.length)],
  );

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialMode = queryParams.get("mode") === "weak" ? "weak" : "all";
  const [studyMode, setStudyMode] = useState<"all" | "weak">(initialMode);
  const [weakCardIds, setWeakCardIds] = useState<string[]>([]);
  const [showRemindToast, setShowRemindToast] = useState(false);

  // Pomodoro
  
  
  
  

  

  
  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Removed redundant localStorage weak cards sync mechanism
  const queueInitDeckIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (deck) {
      if (queueInitDeckIdRef.current === deck.id) return; // Prevent overwriting study state on background syncs
      queueInitDeckIdRef.current = deck.id;

      const weakCards = deck.cards?.filter((c: any) => c.isHard) || [];
      const weakCardIdsList = weakCards.map((c: any) => c.id);
      setWeakCardIds(weakCardIdsList);

      let due = deck.cards || [];
      if (initialMode === "weak") {
        due = weakCards;
        if (due.length === 0) {
          toast("Tuyệt vời! Bạn không còn thẻ nào bị đánh dấu X trong bộ này.");
          due = deck.cards || [];
          setStudyMode("all");
        }
      }
      
      if (deck.id === "daily-quest" && initialMode !== "weak") {
        const now = Date.now();
        // Filter cards based on mastery and next review time
        const reviewCards = due.filter(
          (c: any) => c.mastery > 0 && c.nextReview <= now,
        );
        const newCards = due.filter(
          (c: any) => !c.mastery || c.mastery === 0 || !c.nextReview,
        );

        // Mix 80% review (up to 16 cards) and 20% new (up to 4 cards) = max 20 cards standard
        const shuffledReview = reviewCards
          .sort(() => Math.random() - 0.5)
          .slice(0, 16);
        const shuffledNew = newCards
          .sort(() => Math.random() - 0.5)
          .slice(0, 4);

        due = [...shuffledReview, ...shuffledNew].sort(
          () => Math.random() - 0.5,
        );

        // If no due cards, we can just grab some new or random cards to keep the daily quest active
        if (due.length === 0) {
          due = newCards.sort(() => Math.random() - 0.5).slice(0, 10);
        }
      }
      setStudyQueue(due);

      // Restore study progress
      const progressKey = `study_progress_${user?.id || "guest"}_${deck.id}`;
      const applyLocalProgress = () => {
        const sessionKey = `study_session_data_${user?.id || "guest"}_${deck.id}`;
        const savedIdxStr = localStorage.getItem(progressKey);
        let loadedIdx = 0;
        if (savedIdxStr) {
          const parsed = parseInt(savedIdxStr, 10);
          if (!isNaN(parsed) && parsed > 0 && parsed < due.length) {
            loadedIdx = parsed;
          }
        }
        setCurrentIndex(loadedIdx);
        setIsFlipped(false);
        
        const savedSessionStr = localStorage.getItem(sessionKey);
        if (savedSessionStr && loadedIdx > 0) {
          try {
            const savedSession = JSON.parse(savedSessionStr);
            setSessionMasteryGained(savedSession.masteryGained || 0);
            setSessionTimeSpent(savedSession.timeSpent || 0);
            setSessionHistory(savedSession.history || []);
          } catch(e) {
            setSessionMasteryGained(0);
            setSessionTimeSpent(0);
            setSessionHistory([]);
          }
        } else {
          setSessionMasteryGained(0);
          setSessionTimeSpent(0);
          setSessionHistory([]);
        }
      };

      const handleProgressSynced = () => {
        applyLocalProgress();
      };
      window.addEventListener("vibe-progress-synced", handleProgressSynced);

      applyLocalProgress();

      // Async fetch from Cloud to heal progress if browser was switched
      if (user?.id) {
        VibeProgressSyncManager.pullProgressFromCloud(user.id, deck.id).then((didUpdate) => {
          if (didUpdate) {
             applyLocalProgress();
          }
        }).catch(e => console.error("Auto pull progress error:", e));
      }
      
      return () => {
        window.removeEventListener("vibe-progress-synced", handleProgressSynced);
      };
    }
  }, [deck?.id, user?.id, initialMode]);

  useEffect(() => {
    if (deck && currentIndex !== undefined && currentIndex >= 0) {
      const progressKey = `study_progress_${user?.id || "guest"}_${deck.id}`;
      const sessionKey = `study_session_data_${user?.id || "guest"}_${deck.id}`;
      try {
        localStorage.setItem(progressKey, currentIndex.toString());
        localStorage.setItem(sessionKey, JSON.stringify({
          correctCount: sessionCorrectCount,
          masteryGained: sessionMasteryGained,
          timeSpent: sessionTimeSpent,
          history: sessionHistory
        }));
        VibeProgressSyncManager.markLocalUpdate(user?.id || "guest", deck.id);
      } catch (e) {
        console.warn("Storage Quota Exceeded", e);
      }
    }
  }, [currentIndex, deck?.id, user?.id, sessionCorrectCount, sessionMasteryGained, sessionTimeSpent, sessionHistory]);

  useEffect(() => {
    setIsHintRevealed(false);
  }, [currentIndex]);

  useEffect(() => {
    const unlockAudio = () => {
      initAudio();
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };
    window.addEventListener("click", unlockAudio);
    window.addEventListener("touchstart", unlockAudio);

    return () => {
      window.removeEventListener("click", unlockAudio);
      window.removeEventListener("touchstart", unlockAudio);
    };
  }, []);

  const startReviewXCards = () => {
    if (!deck) return;
    const weakCards = (deck.cards || []).filter((c: any) => weakCardIds.includes(c.id));

    if (weakCards.length === 0) {
      toast("Tuyệt vời! Bạn không còn thẻ nào bị đánh dấu X trong bộ này.");
      return;
    }

    setStudyQueue(weakCards);
    setStudyMode("weak");
    setCurrentIndex(0);
    setFinished(false);
    setIsFlipped(false);
    if (!isPinned) setDeepExplanation(null);
    else setIsMinimized(true);
  };

  const startReviewAll = () => {
    if (!deck) return;
    setStudyQueue(deck.cards || []);
    setStudyMode("all");
    setCurrentIndex(0);
    setFinished(false);
    setIsFlipped(false);
    if (!isPinned) setDeepExplanation(null);
    else setIsMinimized(true);
  };

  const currentCard = studyQueue[currentIndex];

  const canEditCurrentCard = useMemo(() => {
    // Vibe sandbox mode: Cho phép chỉnh sửa thẻ ở chế độ học cho mọi deck (local changes)
    return true;
  }, []);

  const executeActiveCardDeletion = useCallback(async () => {
    if (!deck || !currentCard || !canEditDeck) return;
    setIsUpdatingCard(true);
    try {
      const { db } = await import("../lib/firebase");
      const { doc, getDoc, updateDoc, arrayRemove } =
        await import("firebase/firestore");

      const targetDeckId = (currentCard as any).originDeckId || deck.id;
      const docRef = doc(db, "sets", targetDeckId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentCards = data.cards || [];
        const originalCardObj = currentCards.find(
          (c: any) => c.id === currentCard.id,
        );
        if (originalCardObj) {
          await updateDoc(docRef, {
            cards: arrayRemove(originalCardObj),
          });
        }
      }

      // Update local storage and app state
      store.removeCardLocally(targetDeckId, currentCard.id);

      // Calculate advancing index
      const totalInQueue = studyQueue.length;
      if (totalInQueue <= 1) {
        setFinished(true);
      } else if (currentIndex === totalInQueue - 1) {
        setCurrentIndex(currentIndex - 1);
      } else {
        // Shifting keeps current index same which targets the next available card
      }

      setStudyQueue((prev) => prev.filter((c) => c.id !== currentCard.id));
      setDeleteCountdown(null);
      setIsEditing(false);

      setEditSuccessMessage("Đã xóa thẻ học thành công!");
      setTimeout(() => setEditSuccessMessage(null), 3000);
    } catch (err) {
      console.error("Error deleting active card:", err);
      const { handleFirestoreError, OperationType } =
        await import("../lib/firebase");
      handleFirestoreError(err, OperationType.UPDATE, `sets/`);
    } finally {
      setIsUpdatingCard(false);
    }
  }, [deck?.id, currentCard?.id, canEditDeck, studyQueue, currentIndex]);

  const startDeleteCountdown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (deleteTimerRef.current) {
        clearInterval(deleteTimerRef.current);
      }
      setDeleteCountdown(5);

      const intervalId = setInterval(() => {
        setDeleteCountdown((prev) => {
          if (prev === null) {
            clearInterval(intervalId);
            return null;
          }
          if (prev <= 1) {
            clearInterval(intervalId);
            deleteTimerRef.current = null;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      deleteTimerRef.current = intervalId;
    },
    [executeActiveCardDeletion],
  );

  const handleListen = (
    e?: React.MouseEvent,
    text?: string,
    forceLocale?: string,
  ) => {
    if (e) e.stopPropagation();
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const targetText = text || currentCard?.front || "";
    // Clean up basic markdown symbols, LaTeX and math blocks for better reading
    const cleanText = targetText
      .replace(/\$\$[\s\S]*?\$\$/g, "")
      .replace(/\$[\s\S]*?\$/g, "")
      .replace(/[*_#`\\[\]]/g, "")
      .trim();
    if (!cleanText) return;

    // Detect language if not forced
    const detection = detectLanguage(targetText);
    const locale =
      forceLocale || (detection.isAvailable ? detection.locale : "en-US");

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = locale;
    utterance.rate = 0.9;

    // Auto-Voice Selection: query system voices and correctly bind matching voice
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const voices = window.speechSynthesis.getVoices();
      // Find voices matching the locale prefix or exact match
      const exactMatch = voices.find(
        (v) =>
          v.lang.toLowerCase() === locale.toLowerCase() ||
          v.lang.toLowerCase().replace("_", "-") === locale.toLowerCase(),
      );
      if (exactMatch) {
        utterance.voice = exactMatch;
      } else {
        const prefix = locale.split("-")[0].toLowerCase();
        const prefixMatch = voices.find((v) =>
          v.lang.toLowerCase().startsWith(prefix),
        );
        if (prefixMatch) {
          utterance.voice = prefixMatch;
        }
      }
    }

    window.speechSynthesis.speak(utterance);
  };

  const handleGenerateAICloze = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentCard || isGeneratingCloze) return;
    setIsGeneratingCloze(true);
    try {
      if (!auth.currentUser)
        throw new Error("Vui lòng đăng nhập để sử dụng AI.");

      const res = await safeRequest("/api/automation/hydrate-card", {
        method: "POST",
        body: JSON.stringify({
          front: currentCard.front,
          wordForm: currentCard.wordForm || "",
          back: currentCard.back || "",
        }),
      });

      if (!res.ok) throw new Error("API Exception");
      let data;
        try {
          const text = await res.text();
          data = JSON.parse(text);
        } catch (e) {
          data = { result: "Server Error: " + (e.message || "Invalid JSON") };
        }

      if (data.example) {
        const targetDeckId = currentCard.originDeckId || deck?.id;
        if (!targetDeckId) throw new Error("Chưa xác định ID nhóm thẻ.");

        // Cập nhật Firebase ngay lập tức
        let docRef = doc(db, "sets", targetDeckId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const docData = docSnap.data();
          const docCards: any[] = docData.cards || [];
          const updatedDocCards = docCards.map((c: any) =>
            c.id === currentCard.id
              ? { ...c, example_sentence: data.example }
              : c,
          );
          await updateDoc(docRef, { cards: updatedDocCards });
        }

        // Update local object & store
        store.updateCard(
          targetDeckId,
          currentCard.id,
          currentCard.front,
          currentCard.back,
          data.example,
        );

        setStudyQueue((prevQueue) =>
          prevQueue.map((c) =>
            c.id === currentCard.id
              ? { ...c, example_sentence: data.example }
              : c
          )
        );

        setRawDeck((prev: any) => {
          if (!prev || !prev.cards) return prev;
          return {
            ...prev,
            cards: prev.cards.map((c: any) =>
              c.id === currentCard.id
                ? { ...c, example_sentence: data.example }
                : c
            ),
          };
        });

        toast.success("✅ Đã tạo câu ví dụ để đục lỗ thông minh.");
      } else {
        toast.error("Không thể tạo câu đục lỗ hợp lý.");
      }
    } catch (err: any) {
      toast.error(err.message || "Lỗi kết nối AI khi tạo câu đục lỗ.");
      console.error(err);
    } finally {
      setIsGeneratingCloze(false);
    }
  };

  const getClozeSentence = () => {
    if (!currentCard) return "";
    let sentence = currentCard.example_sentence || "";
    if (!sentence) {
      sentence = `Điền từ thích hợp vào chỗ trống: [${currentCard.front}] (Nghĩa: ${currentCard.back})`;
    }
    return sentence;
  };

  const renderStudyCloze = () => {
    if (!currentCard) return null;

    let sentence = getClozeSentence();

    // Tìm cụm đặt trong ngoặc vuông [...]
    const regex = /\[(.*?)\]/;
    let match = sentence.match(regex);

    // Nếu không tìm thấy cụm đặt trong ngoặc vuông, thử tìm từ khoá trùng khớp với currentCard.front (không phân biệt chữ hoa thường)
    if (!match && currentCard.front) {
      const escapedWord = currentCard.front.replace(
        /[-\/\\^$*+?.()|[\]{}]/g,
        "\\$&",
      );
      // Tìm nguyên từ hoặc cụm từ khớp
      const wordRegex = new RegExp(`\\b(${escapedWord})\\b`, "i");
      if (wordRegex.test(sentence)) {
        sentence = sentence.replace(wordRegex, "[$1]");
        match = sentence.match(regex);
      }
    }

    if (!match) {
      // Fallback khi không khớp gì cả
      return (
        <p className="text-lg sm:text-xl md:text-2xl font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed text-center px-4 break-words whitespace-pre-wrap w-full">
          {sentence}
        </p>
      );
    }

    const targetWord = match[1];
    const sentenceBefore = sentence.substring(0, match.index);
    const sentenceAfter = sentence.substring(match.index! + match[0].length);
    const hint = targetWord.charAt(0) + "_".repeat(targetWord.length - 1);

    const isFallback = !currentCard?.example_sentence;
    const isComplexOrLong = currentCard?.front
      ? currentCard.front.split(" ").length >= 3 ||
        /[\/≠=()]/.test(currentCard.front) ||
        currentCard.front.length > 20
      : false;

    return (
      <div className="flex flex-col items-center justify-center w-full px-2">
        <p className="text-lg sm:text-xl md:text-2xl font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed text-center px-4 w-full break-words whitespace-pre-wrap">
          {sentenceBefore}
          <span
            onClick={(e) => {
              // Ngăn sự kiện click lật thẻ khi bấm vào ô đục lỗ nếu muốn
              e.stopPropagation();
              if (isFallback) return; // Không cần bật hint nếu chỉ hiển thị ______ fallback xấu
              setIsHintRevealed(!isHintRevealed);
            }}
            className={cn(
              "mx-1.5 px-3 py-0.5 rounded-lg border font-bold transition-all inline-block select-none shadow-sm cursor-pointer",
              isFlipped
                ? "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300 border-green-300 dark:border-green-800"
                : isHintRevealed
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-300 dark:border-blue-800"
                  : "bg-orange-100 text-orange-800 dark:bg-orange-950/30 dark:text-orange-400 border-orange-350 dark:border-orange-800/50",
            )}
            title="Bấm để bật/tắt gợi ý từ này"
          >
            {isFlipped ? targetWord : isHintRevealed ? hint : "________"}
          </span>
          {sentenceAfter}
        </p>

        {isFallback && isComplexOrLong && (
          <div
            className="mt-8 flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleGenerateAICloze}
              disabled={isGeneratingCloze}
              className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 shadow-md transition-all font-medium text-sm disabled:opacity-70 disabled:cursor-wait"
            >
              {isGeneratingCloze ? (
                <RefreshCcw className="w-5 h-5 animate-spin" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
              {isGeneratingCloze
                ? "AI Đang xử lý..."
                : "Agent 2: Sinh câu đục lỗ ngữ cảnh"}
            </button>
            <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500 max-w-xs text-center font-light">
              Thẻ này hơi phức tạp để đục lỗ chay. Khuyên ngài nên dùng AI tạo
              ra câu ví dụ ngữ cảnh để học hiệu quả hơn.
            </p>
          </div>
        )}
      </div>
    );
  };

  const handleReportError = useCallback(async () => {
    if (!currentCard || !deck) return;

    try {
      const cardIndex =
        deck.cards.findIndex((c: any) => c.id === currentCard.id) + 1;
      const reportText = `🚨 REPORT CARD ERROR 🚨\n\n📌 Deck: ${deck.title}\n🃏 Card: #${cardIndex}/${deck.cards.length} (ID: ${currentCard.id})\n🔗 URL: ${window.location.href}\n\nFRONT:\n${currentCard.front}\n\nBACK:\n${currentCard.back}\n\n---\nPlease describe the error here: `;

      try {
        await navigator.clipboard.writeText(reportText);
      } catch (err) {
        console.warn("Clipboard permission denied or failed", err);
      }

      window.open("https://t.me/+O50q6ltXTzwxMzk1", "_blank");
    } catch (err) {
      console.error("Error generating report", err);
    }
  }, [currentCard?.id, deck?.id, deck?.title, deck?.cards?.length]);

  const handleMark = useCallback(
    (remembered: boolean) => {
      initAudio();
      if (currentCard) {
        if (remembered) {
          playCorrectSound();
          if (
            typeof navigator !== "undefined" &&
            typeof navigator.vibrate === "function"
          ) {
            navigator.vibrate(80); // Short nudge for correct answer
          }
        } else {
          playIncorrectSound();
          if (
            typeof navigator !== "undefined" &&
            typeof navigator.vibrate === "function"
          ) {
            navigator.vibrate([60, 40, 60]); // Double pulse for incorrect answer
          }
        }

        const oldMastery = currentCard.mastery || 0;
        let diff = 0;
        if (remembered) {
          diff = Math.min(100, oldMastery + 20) - oldMastery;
        } else {
          diff = Math.max(0, oldMastery - 20) - oldMastery;
        }

        const targetDeckId = currentCard.originDeckId || deck?.id;
        if (targetDeckId) {
          store.updateCardMastery(targetDeckId, currentCard.id, remembered);
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("vibe-card-states-updated", {
                detail: {
                  states: [{ cardId: currentCard.id, isWeakCard: !remembered }],
                },
              })
            );
          }
        }
        
        // Update local object to reflect new mastery for subsequent reviews in the same session
        currentCard.mastery = oldMastery + diff;
        
        setSessionMasteryGained((prev) => prev + diff);

        setSessionHistory((prev) => {
          const newStatus = remembered ? "correct" : "incorrect";
          const next = [...prev];
          
          next.push({
              cardId: currentCard.id,
              cardIndex: prev.length + 1,
              front: currentCard.front,
              status: newStatus,
              masteryChange: diff,
              cumulativeCorrect: 0,
              cumulativeStudied: 0,
              accuracy: 0,
          });
          
          let runningCorrect = 0;
          return next.map((item, idx) => {
              if (item.status === "correct") runningCorrect++;
              return {
                  ...item,
                  cardIndex: idx + 1,
                  cumulativeCorrect: runningCorrect,
                  cumulativeStudied: idx + 1,
                  accuracy: Math.round((runningCorrect / (idx + 1)) * 100)
              };
          });
        });

        if (deck) {
          setWeakCardIds((prevIds) => {
            let weakIds = [...prevIds];
            if (!remembered) {
              if (!weakIds.includes(currentCard.id)) {
                weakIds.push(currentCard.id);
              }
            } else {
              weakIds = weakIds.filter((id: string) => id !== currentCard.id);
            }
            return weakIds;
          });
        }
      }

      if (!isPinned) setDeepExplanation(null);
      else setIsMinimized(true);

      setIsFlipped(false);
      if (currentIndex + 1 < studyQueue.length) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        setSessionTimeSpent(Math.round((Date.now() - sessionStartTime) / 1000));
        setFinished(true);
      }
    },
    [
      currentCard,
      deck,
      sessionHistory.length,
      isPinned,
      currentIndex,
      studyQueue.length,
      sessionStartTime,
    ],
  );

  const handleRestart = useCallback(() => {
    if (window.confirm("Bạn có muốn quay lại thẻ đầu tiên để học lại từ đầu?")) {
      setCurrentIndex(0);
      setIsFlipped(false);
      if (!isPinned) setDeepExplanation(null);
      else setIsMinimized(true);
    }
  }, [isPinned]);

  const handlePrevCard = useCallback(() => {
    if (currentIndex > 0) {
      if (!isPinned) setDeepExplanation(null);
      else setIsMinimized(true);
      setIsFlipped(false);
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex, isPinned]);

  const handleNextCard = useCallback(() => {
    if (currentIndex + 1 < studyQueue.length) {
      if (!isPinned) setDeepExplanation(null);
      else setIsMinimized(true);
      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
    } else {
      setSessionTimeSpent(Math.round((Date.now() - sessionStartTime) / 1000));
      setFinished(true);
    }
  }, [currentIndex, studyQueue.length, isPinned, sessionStartTime]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (finished || !currentCard || isExtracting || isEditing) return;

      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        handleFlip();
      } else if (e.code === "KeyL") {
        e.preventDefault();
        if (!isFlipped) {
          const text = currentCard?.front || (currentCard as any)?.word || "";
          const check = detectLanguage(text);
          if (check.isAvailable) {
            handleListen(undefined, text, check.locale);
          }
        } else {
          const text = currentCard?.back || (currentCard as any)?.meaning || "";
          const check = detectLanguage(text);
          if (check.isAvailable) {
            handleListen(undefined, text, check.locale);
          }
        }
      } else if (e.code === "ArrowLeft") {
        if (isFlipped) {
          e.preventDefault();
          handleMark(false);
        } else {
          e.preventDefault();
          handlePrevCard();
        }
      } else if (e.code === "ArrowRight") {
        if (isFlipped) {
          e.preventDefault();
          handleMark(true);
        } else {
          e.preventDefault();
          handleNextCard();
        }
      } else if (e.code === "ArrowDown") {
        if (isFlipped) {
          e.preventDefault();
          handleRemindLater();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    finished,
    currentCard,
    isExtracting,
    isEditing,
    isFlipped,
    deckId,
    currentIndex,
    sessionCorrectCount,
    sessionHistory.length,
    handlePrevCard,
    handleNextCard,
  ]); // Keep all necessary dependencies

  const handleAgent2 = async () => {
    if (!currentCard) return;

    if (user && user.role === "student" && cooldownRemaining > 0) {
      setDeepExplanation(
        `⏳ **Hệ thống AI đang hạ nhiệt**: Bạn là Học sinh, vui lòng đợi thêm **${cooldownRemaining} giây** để hỏi giải thích tiếp theo nhé.`,
      );
      return;
    }

    setIsExtracting(true);
    setActiveAgent(2);
    setDeepExplanation(null);
    setIsMinimized(false);

    if (user && user.role === "student" && !user.isPro) {
      startCooldown();
    }

    try {
      const idToken = (await auth.currentUser?.getIdToken()) || "";
      const res = await safeRequest("/api/agent2/explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
          "x-user-is-pro": user?.isPro ? "true" : "false",
        },
        body: JSON.stringify({
          term: currentCard.front,
          definition: currentCard.back,
          subject: currentCard.subject,
        }),
      });

      if (!res.ok) {
        let errData;
        try {
          const text = await res.text();
          errData = JSON.parse(text);
        } catch (e) {
          errData = { error: "Server Error: " + (e.message || "Invalid JSON") };
        }
        if (res.status === 429) {
          setDeepExplanation(
            `⏳ **Cooldown 20s**: ${errData.error || "Bạn đang gọi AI quá nhanh. Hãy chờ!"}`,
          );
          setIsExtracting(false);
          return;
        }
        throw new Error(errData.error || "Failed to query express backend");
      }

      let data;
        try {
          const text = await res.text();
          data = JSON.parse(text);
        } catch (e) {
          data = { result: "Server Error: " + (e.message || "Invalid JSON") };
        }
      setDeepExplanation(data.result);
    } catch (e: any) {
      setDeepExplanation(
        "Failed to router extract. Check AI connection. Error: " +
          (e.message || e),
      );
    }
    setIsExtracting(false);
  };

  const handlePrepareCustomPrompt = async (): Promise<{ cardType: string; suggestedPrompt: string }> => {
    if (!currentCard) return { cardType: "KHÁI NIỆM HỌC TẬP", suggestedPrompt: "" };

    const idToken = (await auth.currentUser?.getIdToken()) || "";
    const contextualPrompt = `Thẻ học hiện tại:\nMặt trước (Từ khóa/Câu hỏi): ${currentCard?.front || "Trống"}\nMặt sau (Nghĩa/Đáp án): ${currentCard?.back || "Trống"}\nVí dụ mẫu: ${currentCard?.example_sentence || "Không có"}\nChủ đề: ${currentCard?.subject || "Khác"}`;

    try {
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
          message: contextualPrompt,
          context: contextualPrompt,
          mode: "prompt_builder",
          skipCooldown: true,
        }),
      });

      let data;
        try {
          const text = await res.text();
          data = JSON.parse(text);
        } catch (e) {
          data = { result: "Server Error: " + (e.message || "Invalid JSON") };
        }
      let parsed: { cardType?: string; suggestedPrompt?: string } = {};
      if (data && data.result) {
        try {
          const jsonMatch = typeof data.result === "string" ? data.result.match(/\{[\s\S]*\}/) : null;
          if (jsonMatch) {
            parsed = JSON.parse(jsonMatch[0]);
          } else if (typeof data.result === "object") {
            parsed = data.result;
          }
        } catch (e) {
          console.warn("Could not parse JSON from AI prompt builder:", e);
        }
      }

      if (parsed.cardType && parsed.suggestedPrompt) {
        return {
          cardType: parsed.cardType,
          suggestedPrompt: parsed.suggestedPrompt
        };
      }
    } catch (err) {
      console.error("Error preparing custom prompt:", err);
    }

    // Local fallback if API fails or cannot be parsed
    const frontText = currentCard?.front?.trim() || "";
    const backText = currentCard?.back?.trim() || "";
    const isQuestion =
      /[?？]/.test(frontText) ||
      /\b(chọn|đáp án|câu hỏi|câu nào|tại sao|nguyên nhân|which|what|where|when|why|how|select|choose|fill|correct|incorrect|find)\b/i.test(frontText) ||
      /\b[A-D][.s)]\b/.test(frontText) ||
      /\b[A-D][.s)]\b/.test(backText);

    const isEnglishText = !/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(frontText);
    const isVocab = !isQuestion && (isEnglishText || !!currentCard?.wordForm || frontText.split(" ").length <= 6);

    if (isQuestion) {
      return {
        cardType: "CÂU HỎI / BÀI TẬP TRẮC NGHIỆM",
        suggestedPrompt: `Thẻ học này thuộc dạng CÂU HỎI / BÀI TẬP. Hãy giải bài và giải thích đáp án một cách "Siêu Tốc", Trực Diện và Súc Tích nhất:\n1. Giải thích vì sao đáp án đúng lại đúng.\n2. Phân tích vì sao các đáp án khác sai (nếu có lựa chọn và có giá trị học tập).\n3. LƯU Ý QUAN TRỌNG: CHỈ ghi những phân tích thực sự có giá trị học tập. KHÔNG ghi tiêu đề trống hay mục rỗng không có thông tin gây chiếm vị trí.`
      };
    } else if (isVocab) {
      return {
        cardType: "TỪ VỰNG / CỤM TỪ TIẾNG ANH",
        suggestedPrompt: `Thẻ học này thuộc dạng TỪ VỰNG / CỤM TỪ / THÀNH NGỮ / CỤM ĐỘNG TỪ. Hãy bóc tách và giải thích một cách "Siêu Tốc", Trực Diện và Súc Tích nhất:\n1. Bóc tách nghĩa cốt lõi ngắn gọn.\n2. Đính kèm phiên âm IPA chuẩn xác ngay cạnh từ/cụm từ (nếu là tiếng Anh).\n3. Đưa ra 1 Ví dụ minh họa thực tế ngắn gọn (kèm câu Tiếng Anh & dịch nghĩa Tiếng Việt).\n4. Nguồn gốc / Lịch sử / Mẹo ghi nhớ: CHỈ ghi mục này nếu thực sự có giá trị học tập giúp dễ nhớ. Nếu không có hoặc không đặc sắc, TUYỆT ĐỐI BỎ QUA, không ghi tiêu đề trống!`
      };
    }

    return {
      cardType: "KHÁI NIỆM HỌC TẬP CHUNG",
      suggestedPrompt: `Hãy bóc tách và giải thích khái niệm / nội dung này một cách "Siêu Tốc", Trực Diện và Súc Tích nhất:\n1. Nêu bật bản chất cốt lõi ngay lập tức.\n2. Ví dụ hoặc mẹo nhớ ngắn gọn (CHỈ ghi nếu có giá trị học tập, tuyệt đối cấm để mục trống).`
    };
  };

  const handleAgent3 = async (customPromptOverride?: string, useProModel?: boolean) => {
    if (!currentCard) return;

    if (user && user.role === "student" && cooldownRemaining > 0) {
      setDeepExplanation(
        `⏳ **Hệ thống AI đang hạ nhiệt**: Bạn là Học sinh, vui lòng đợi thêm **${cooldownRemaining} giây** để hỏi giải thích tiếp theo nhé.`,
      );
      return;
    }

    setIsExtracting(true);
    setActiveAgent(3);
    setDeepExplanation(null);
    setIsMinimized(false);

    if (user && user.role === "student" && !user.isPro) {
      startCooldown();
    }

    try {
      const idToken = (await auth.currentUser?.getIdToken()) || "";
      const contextualPrompt = `Thẻ học hiện tại:\nTừ khóa: ${currentCard?.front || "Trống"}\nNghĩa: ${currentCard?.back || "Trống"}\nVí dụ mẫu: ${currentCard?.example_sentence || "Không có"}\nChủ đề: ${currentCard?.subject || "Khác"}`;

      let promptToSend = customPromptOverride;

      if (!promptToSend) {
        const frontText = currentCard?.front?.trim() || "";
        const backText = currentCard?.back?.trim() || "";

        // Auto-detect content type
        const isQuestion =
          /[?？]/.test(frontText) ||
          /\b(chọn|đáp án|câu hỏi|câu nào|tại sao|nguyên nhân|which|what|where|when|why|how|select|choose|fill|correct|incorrect|find)\b/i.test(frontText) ||
          /\b[A-D][.s)]\b/.test(frontText) ||
          /\b[A-D][.s)]\b/.test(backText);

        const isEnglishText = !/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(frontText);
        const isVocab = !isQuestion && (isEnglishText || !!currentCard?.wordForm || frontText.split(" ").length <= 6);

        if (isQuestion) {
          promptToSend = `Thẻ học này thuộc dạng CÂU HỎI / BÀI TẬP. Hãy giải bài và giải thích đáp án một cách "Siêu Tốc", Trực Diện và Súc Tích nhất:
1. Giải thích vì sao đáp án đúng lại đúng.
2. Phân tích vì sao các đáp án khác sai (nếu có lựa chọn và có giá trị học tập).
3. LƯU Ý QUAN TRỌNG: CHỈ ghi những phân tích thực sự có giá trị học tập. KHÔNG ghi tiêu đề trống hay mục rỗng không có thông tin gây chiếm vị trí.`;
        } else if (isVocab) {
          promptToSend = `Thẻ học này thuộc dạng TỪ VỰNG / CỤM TỪ / THÀNH NGỮ / CỤM ĐỘNG TỪ. Hãy bóc tách và giải thích một cách "Siêu Tốc", Trực Diện và Súc Tích nhất:
1. Bóc tách nghĩa cốt lõi ngắn gọn.
2. Đính kèm phiên âm IPA chuẩn xác ngay cạnh từ/cụm từ (nếu là tiếng Anh).
3. Đưa ra 1 Ví dụ minh họa thực tế ngắn gọn (kèm câu Tiếng Anh & dịch nghĩa Tiếng Việt).
4. Nguồn gốc / Lịch sử / Mẹo ghi nhớ: CHỈ ghi mục này nếu thực sự có giá trị học tập giúp dễ nhớ. Nếu không có hoặc không đặc sắc, TUYỆT ĐỐI BỎ QUA, không ghi tiêu đề trống!`;
        } else {
          promptToSend = `Hãy bóc tách và giải thích khái niệm / nội dung này một cách "Siêu Tốc", Trực Diện và Súc Tích nhất:
1. Nêu bật bản chất cốt lõi ngay lập tức.
2. Ví dụ hoặc mẹo nhớ ngắn gọn (CHỈ ghi nếu có giá trị học tập, tuyệt đối cấm để mục trống).`;
        }
      }

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
          message: promptToSend,
          context: contextualPrompt,
          mode: "flashcard_assist",
          responseMode: "direct",
          responseStyle: "concise",
          useProModel: useProModel
        }),
      });

      if (!res.ok) {
        let errData;
        try {
          const text = await res.text();
          errData = JSON.parse(text);
        } catch (e) {
          errData = { error: "Server Error: " + (e.message || "Invalid JSON") };
        }
        if (res.status === 429) {
          setDeepExplanation(
            `⏳ **Cooldown 20s**: ${errData.error || "Bạn đang gọi AI quá nhanh. Hãy chờ!"}`,
          );
          setIsExtracting(false);
          return;
        }
        throw new Error(errData.error || "Failed to query express backend");
      }

      let data;
        try {
          const text = await res.text();
          data = JSON.parse(text);
        } catch (e) {
          data = { result: "Server Error: " + (e.message || "Invalid JSON") };
        }
      setDeepExplanation(data.result);
    } catch (e: any) {
      setDeepExplanation(
        "Failed to agent 3 extract. Check AI connection. Error: " +
          (e.message || e),
      );
    }
    setIsExtracting(false);
  };

  const handleRemindLater = () => {
    if (!currentCard) return;
    const existing = JSON.parse(
      localStorage.getItem("remind_later_items") || "[]",
    );
    if (!existing.includes(currentCard.id)) {
      existing.push(currentCard.id);
      localStorage.setItem("remind_later_items", JSON.stringify(existing));
    }

    setShowRemindToast(true);
    setTimeout(() => setShowRemindToast(false), 2000);

    setSessionHistory((prev) => {
        const next = [...prev];
        
        next.push({
            cardId: currentCard.id,
            cardIndex: prev.length + 1,
            front: currentCard.front,
            status: "skipped",
            masteryChange: 0,
            cumulativeCorrect: 0,
            cumulativeStudied: 0,
            accuracy: 0,
        });
        
        let runningCorrect = 0;
        return next.map((item, idx) => {
            if (item.status === 'correct') runningCorrect++;
            return {
                ...item,
                cardIndex: idx + 1,
                cumulativeCorrect: runningCorrect,
                cumulativeStudied: idx + 1,
                accuracy: Math.round((runningCorrect / (idx + 1)) * 100)
            };
        });
    });

    // Move to next card
    setIsFlipped(false);
    if (!isPinned) setDeepExplanation(null);
    else setIsMinimized(true);

    if (currentIndex + 1 < studyQueue.length) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setSessionTimeSpent(Math.round((Date.now() - sessionStartTime) / 1000));
      setFinished(true);
    }
  };

  const handleEditOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditFront(currentCard.front);
    setEditBack(currentCard.back);
    setEditExampleSentence(currentCard.example_sentence || "");
    setIsEditing(true);
  };

  const handleSaveEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!deck || !currentCard) return;

    setIsUpdatingCard(true);
    try {
      const targetDeckId = currentCard.originDeckId || deck.id;

      // 1. Update local state immediately for sandbox mode (real-time UI update)
      store.updateCard(
        targetDeckId,
        currentCard.id,
        editFront,
        editBack,
        editExampleSentence,
      );
      setStudyQueue((prevQueue) =>
        prevQueue.map((c) =>
          c.id === currentCard.id
            ? {
                ...c,
                front: editFront,
                back: editBack,
                example_sentence: editExampleSentence,
              }
            : c
        )
      );
      setRawDeck((prev: any) => {
        if (!prev || !prev.cards) return prev;
        return {
          ...prev,
          cards: prev.cards.map((c: any) =>
            c.id === currentCard.id
              ? {
                  ...c,
                  front: editFront,
                  back: editBack,
                  example_sentence: editExampleSentence,
                }
              : c
          ),
        };
      });

      // Immediately update UI
      setIsEditing(false);
      setIsUpdatingCard(false); // Move here for optimistic UI
      setEditSuccessMessage("Đã cập nhật dữ liệu thẻ thành công!");
      setTimeout(() => setEditSuccessMessage(null), 3000);

      // 2. Try updating Firestore (background sync non-blocking)
      (async () => {
        try {
          const { db } = await import("../lib/firebase");
          const { doc, getDoc, updateDoc } = await import("firebase/firestore");
          
          let updatedDocCards = [];
          const docRef = doc(db, "sets", targetDeckId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            const currentCards = data.cards || [];
            updatedDocCards = currentCards.map((c: any) =>
              c.id === currentCard.id
                ? {
                    ...c,
                    front: editFront,
                    back: editBack,
                    example_sentence: editExampleSentence,
                  }
                : c,
            );
          } else {
            updatedDocCards = [
              {
                ...currentCard,
                front: editFront,
                back: editBack,
                example_sentence: editExampleSentence,
              },
            ];
          }

          await updateDoc(docRef, {
            cards: updatedDocCards,
          });
        } catch (firestoreErr) {
          console.warn("Firestore update skipped or failed (Offline/Sandbox Mode):", firestoreErr);
        }
      })();
    } catch (err) {
      console.error("Lỗi khi chỉnh sửa:", err);
      // We don't trigger the fatal handleFirestoreError modal for sandbox edits
      setIsUpdatingCard(false); // Only toggle false here if it failed before optimistic success
    }
  };

  const handleSaveFormattedCard = async (newFront: string, newBack: string, newExample?: string) => {
    if (!deck || !currentCard) return;
    setIsUpdatingCard(true);
    try {
      const targetDeckId = currentCard.originDeckId || deck.id;

      // 1. Update local state immediately for sandbox
      store.updateCard(
        targetDeckId,
        currentCard.id,
        newFront,
        newBack,
        newExample !== undefined ? newExample : (currentCard.example_sentence || ""),
      );
      
      setStudyQueue((prevQueue) =>
        prevQueue.map((c) =>
          c.id === currentCard.id
            ? {
                ...c,
                front: newFront,
                back: newBack,
                example_sentence: newExample !== undefined ? newExample : c.example_sentence,
              }
            : c
        )
      );

      setRawDeck((prev: any) => {
        if (!prev || !prev.cards) return prev;
        return {
          ...prev,
          cards: prev.cards.map((c: any) =>
            c.id === currentCard.id
              ? {
                  ...c,
                  front: newFront,
                  back: newBack,
                  example_sentence: newExample !== undefined ? newExample : c.example_sentence,
                }
              : c
          ),
        };
      });

      // 2. Try update Firestore (non-blocking when offline)
      (async () => {
        try {
          const { db } = await import("../lib/firebase");
          const { doc, getDoc, updateDoc } = await import("firebase/firestore");

          const docRef = doc(db, "sets", targetDeckId);
          const docSnap = await getDoc(docRef);
          let updatedDocCards = [];
          if (docSnap.exists()) {
            const data = docSnap.data();
            const currentCards = data.cards || [];
            updatedDocCards = currentCards.map((c: any) =>
              c.id === currentCard.id
                ? {
                    ...c,
                    front: newFront,
                    back: newBack,
                    example_sentence: newExample !== undefined ? newExample : (c.example_sentence || ""),
                  }
                : c,
            );
            await updateDoc(docRef, { cards: updatedDocCards });
          }
        } catch (firestoreErr) {
          console.warn("Firestore sync skipped or failed (Offline/Sandbox Mode):", firestoreErr);
        }
      })();

      setEditFront(newFront);
      setEditBack(newBack);
      if (newExample !== undefined) setEditExampleSentence(newExample);

      setIsUpdatingCard(false); // Move here for optimistic UI
      setEditSuccessMessage("Đã định dạng và cập nhật thẻ thành công!");
      setTimeout(() => setEditSuccessMessage(null), 3000);
    } catch (err) {
      console.error("Lỗi khi lưu định dạng thẻ:", err);
      setIsUpdatingCard(false);
    }
  };

  const handleTranslateDefinitionRequest = () => {
    if (!currentCard) return;
    setConfirmTranslateCardId(currentCard.id);
  };

  const executeTranslateDefinition = async (cardIdToTranslate: string) => {
    // Find the card in the latest studyQueue or deck to translate
    const targetCard = studyQueue.find((c) => c.id === cardIdToTranslate) || (deck?.cards || []).find((c: any) => c.id === cardIdToTranslate);
    if (!targetCard || !deck) return;

    setIsTranslatingDefinition(true);
    try {
      const res = await safeRequest("/api/vibe/translate-definition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: targetCard.back || "",
        }),
      });

      if (!res.ok) {
        throw new Error("Không thể kết nối dịch vụ dịch thuật AI.");
      }

      const data = await res.json();
      const translatedBack = data.translatedText;
      if (!translatedBack) {
        throw new Error("Dữ liệu dịch trả về bị trống.");
      }

      const targetDeckId = targetCard.originDeckId || deck.id;

      // 1. Update local state immediately for sandbox
      store.updateCard(
        targetDeckId,
        targetCard.id,
        targetCard.front,
        translatedBack,
        targetCard.example_sentence || ""
      );

      setStudyQueue((prevQueue) =>
        prevQueue.map((c) =>
          c.id === targetCard.id
            ? {
                ...c,
                back: translatedBack,
              }
            : c
        )
      );

      setRawDeck((prev: any) => {
        if (!prev || !prev.cards) return prev;
        return {
          ...prev,
          cards: prev.cards.map((c: any) =>
            c.id === targetCard.id
              ? {
                  ...c,
                  back: translatedBack,
                }
              : c
          ),
        };
      });

      // 2. Try update Firestore (non-blocking when offline)
      (async () => {
        try {
          const { db } = await import("../lib/firebase");
          const { doc, getDoc, updateDoc } = await import("firebase/firestore");

          const docRef = doc(db, "sets", targetDeckId);
          const docSnap = await getDoc(docRef);
          let updatedDocCards = [];
          if (docSnap.exists()) {
            const data = docSnap.data();
            const currentCards = data.cards || [];
            updatedDocCards = currentCards.map((c: any) =>
              c.id === targetCard.id
                ? {
                    ...c,
                    back: translatedBack,
                  }
                : c
            );
            await updateDoc(docRef, { cards: updatedDocCards });
          }
        } catch (firestoreErr) {
          console.warn("Firestore sync skipped or failed (Offline/Sandbox Mode):", firestoreErr);
        }
      })();

      if (currentCard?.id === targetCard.id) {
        setEditBack(translatedBack);
      }
      setIsTranslatingDefinition(false); // Move here for optimistic UI
      toast.success("✅ Đã dịch định nghĩa sang tiếng Việt thành công!");
    } catch (err: any) {
      console.error("Lỗi khi dịch thẻ:", err);
      toast.error(err.message || "Lỗi dịch thuật thẻ.");
      setIsTranslatingDefinition(false);
    }
  };

  const handleAddCard = async () => {
    if (!deck || !canEditDeck) return;
    // Logic removed
    setIsUpdatingCard(true);
    try {
      const { db } = await import("../lib/firebase");
      const { doc, updateDoc, arrayUnion } = await import("firebase/firestore");

      const newCardObj: Flashcard = {
        id: `card_${uuidv4().substring(0, 8)}`,
        front: "Khái niệm mới",
        back: "Giải nghĩa chi tiết",
        subject: deck.subject || "general",
        mastery: 0,
        nextReview: Date.now(),
        isHard: false,
        example_sentence: "",
      };

      await updateDoc(doc(db, "sets", deck.id), {
        cards: arrayUnion(newCardObj),
      });

      store.addCardLocally(deck.id, newCardObj);
      setStudyQueue((prev) => [...prev, newCardObj]);

      setEditSuccessMessage("Đã thêm một thẻ mới vào bộ học tập!");
      setTimeout(() => setEditSuccessMessage(null), 3000);
    } catch (err) {
      const { handleFirestoreError, OperationType } =
        await import("../lib/firebase");
      handleFirestoreError(err, OperationType.UPDATE, `sets/${deck.id}`);
    } finally {
      setIsUpdatingCard(false);
    }
  };

  const handleRemoveCard = async (targetCard: Flashcard) => {
    if (!deck || !canEditDeck) return;
    setIsUpdatingCard(true);
    try {
      const targetDeckId = (targetCard as any).originDeckId || deck.id;

      // 1. Update locally first
      store.removeCardLocally(targetDeckId, targetCard.id);
      setStudyQueue((prev) => prev.filter((c) => c.id !== targetCard.id));

      // 2. Try Firestore sync (non-blocking)
      try {
        const { db } = await import("../lib/firebase");
        const { doc, getDoc, updateDoc } = await import("firebase/firestore");

        const docRef = doc(db, "sets", targetDeckId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          const currentCards = data.cards || [];
          const filteredCards = currentCards.filter(
            (c: any) => c.id !== targetCard.id,
          );
          await updateDoc(docRef, {
            cards: filteredCards,
          });
        }
      } catch (firestoreErr) {
        console.warn("Firestore delete sync skipped or failed (Offline/Sandbox Mode):", firestoreErr);
      }

      setEditSuccessMessage("Đã xóa thẻ thành công!");
      setTimeout(() => setEditSuccessMessage(null), 3000);
    } catch (err) {
      console.error("Lỗi khi xóa thẻ:", err);
    } finally {
      setIsUpdatingCard(false);
    }
  };

  const handleVirtualPlayCard = useCallback((c: Flashcard) => {
    setStudyQueue((prevQueue) => {
      const indexInQueue = prevQueue.findIndex((qCard) => qCard.id === c.id);
      if (indexInQueue !== -1) {
        setCurrentIndex(indexInQueue);
        setIsFlipped(false);
      }
      return prevQueue;
    });
  }, []);

  const filteredCards = useMemo(() => {
    if (!deck?.cards) return [];
    const query = listSearchQuery.toLowerCase().trim();
    if (!query) return deck.cards;
    return deck.cards.filter(
      (c) =>
        (c.front || "").toLowerCase().includes(query) ||
        (c.back || "").toLowerCase().includes(query) ||
        (c.wordForm || "").toLowerCase().includes(query),
    );
  }, [deck?.cards, listSearchQuery]);

  const handleSelectCardFromList = useCallback(
    (card: Flashcard) => {
      if (!deck) return;

      let targetQueue = studyQueue;
      const indexInQueue = studyQueue.findIndex(
        (qCard) => qCard.id === card.id,
      );

      if (indexInQueue === -1) {
        targetQueue = deck.cards || [];
        setStudyQueue(targetQueue);
        setStudyMode("all");
        setFinished(false);
        if (!isPinned) setDeepExplanation(null);
        else setIsMinimized(true);
      }

      const finalIndex = targetQueue.findIndex((qCard) => qCard.id === card.id);
      if (finalIndex !== -1) {
        setCurrentIndex(finalIndex);
      }
      setIsFlipped(false);
      setIsListModalOpen(false);
    },
    [deck, studyQueue, isPinned],
  );

  const handleVirtualEditCard = useCallback((c: Flashcard) => {
    setStudyQueue((prevQueue) => {
      const indexInQueue = prevQueue.findIndex((qCard) => qCard.id === c.id);
      if (indexInQueue !== -1) {
        setCurrentIndex(indexInQueue);
      }
      return prevQueue;
    });
    setEditFront(c.front);
    setEditBack(c.back);
    setEditExampleSentence(c.example_sentence || "");
    setIsEditing(true);
    window.scrollTo({ top: 300, behavior: "smooth" });
  }, []);

  const handleVirtualDeleteCard = useCallback(
    (c: Flashcard) => {
      handleRemoveCard(c);
    },
    [handleRemoveCard],
  );

  if (finished) {
    const recommendedDecks = deck && deck.subject 
      ? store.getDecks().filter((d: any) => d.subject === deck.subject && d.id !== deck.id && d.cards && d.cards.length > 0).slice(0, 4) 
      : [];

    const percentage =
      studyQueue.length > 0
        ? Math.round((sessionCorrectCount / studyQueue.length) * 100)
        : 0;
    const memoryProjection = Math.round(percentage * 0.7);

    // Compute Benchmark Stats
    const sessionCardsMasteryAvg = studyQueue.length
      ? Math.round(
          studyQueue.reduce((sum, c) => sum + (Number(c.mastery) || 0), 0) /
            studyQueue.length,
        )
      : 0;

    const currentDeckMasteryAvg = deck?.cards?.length
      ? Math.round(
          deck.cards.reduce(
            (sum: number, c: any) => sum + (c.mastery || 0),
            0,
          ) / deck.cards.length,
        )
      : 0;

    let weeklyAvgMastery = 0;
    if (user) {
      const allDecks = store.getDecks();
      const allCards = allDecks.flatMap((d) => d.cards || []);

      const userHistory = store.getReviewHistory(user.id);
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const weeklyReviews = userHistory.filter(
        (r) => r.timestamp >= oneWeekAgo,
      );

      if (weeklyReviews.length > 0) {
        const reviewedCardIds = new Set(weeklyReviews.map((r) => r.cardId));
        const reviewedCards = allCards.filter((c) => reviewedCardIds.has(c.id));
        if (reviewedCards.length > 0) {
          weeklyAvgMastery = Math.round(
            reviewedCards.reduce((sum, c) => sum + (c.mastery || 0), 0) /
              reviewedCards.length,
          );
        }
      }

      if (weeklyAvgMastery === 0 && allCards.length > 0) {
        weeklyAvgMastery = Math.round(
          allCards.reduce((sum, c) => sum + (c.mastery || 0), 0) /
            allCards.length,
        );
      }
    }

    if (weeklyAvgMastery === 0) {
      weeklyAvgMastery = 50;
    }

    const deltaMastery = sessionCardsMasteryAvg - weeklyAvgMastery;

    return (
      <div className="flex items-center justify-center min-h-[80vh] py-8 animate-in zoom-in-95 duration-500 px-4">
        <div className="glass p-6 md:p-10 rounded-3xl max-w-5xl w-full space-y-8 relative z-10">
          {/* Header Section */}
          <div className="text-center space-y-2 relative">
            <motion.div
              initial={{ scale: 0, opacity: 0, rotate: -20, y: 20 }}
              animate={{
                scale: [0, 1.2, 1],
                opacity: 1,
                rotate: [-20, 10, -5, 0],
                y: 0,
              }}
              transition={{
                delay: 0.2,
                type: "spring",
                stiffness: 200,
                damping: 10,
              }}
              className="absolute -top-10 md:-top-16 left-1/2 -translate-x-1/2 pointer-events-none"
            >
              <span className="text-4xl md:text-5xl font-black font-display text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-500 drop-shadow-lg">
                GREAT JOB!
              </span>
            </motion.div>
            <div className="mt-8 inline-flex items-center justify-center bg-orange-500/10 text-orange-600 dark:text-orange-400 px-4 py-1.5 rounded-full text-sm font-bold border border-orange-500/20">
              🎉 HOÀN THÀNH PHIÊN HỌC
            </div>
            <h2 className="text-3xl md:text-4xl font-black font-display text-zinc-800 dark:text-zinc-100 mt-4">
              Chúc Mừng Bạn Đã Học Xong!
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Metrics and Control Buttons */}
            <div className="lg:col-span-5 space-y-6">
              {/* Circular Percentage and quick view */}
              <div className="bg-zinc-200/50 dark:bg-zinc-800/40 p-6 rounded-2xl border border-orange-600/10 dark:border-orange-500/20 flex flex-col items-center">
                <div className="relative w-36 h-36 flex flex-col items-center justify-center mb-4">
                  <div className="absolute inset-0 bg-orange-500/10 rounded-full animate-pulse"></div>
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-60 text-zinc-500 dark:text-zinc-400">
                    Tỷ lệ đúng
                  </span>
                  <span className="text-4xl font-display font-black text-orange-600 dark:text-orange-400">
                    {percentage}%
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full text-center">
                  <div className="bg-background/40 p-2 rounded-xl border border-zinc-200/50 dark:border-zinc-850">
                    <span className="block text-lg font-black text-zinc-800 dark:text-zinc-200">
                      {studyQueue.length}
                    </span>
                    <span className="text-[9px] uppercase font-bold opacity-60 block mt-0.5">
                      Đã ôn
                    </span>
                  </div>
                  <div className="bg-background/40 p-2 rounded-xl border border-zinc-200/50 dark:border-zinc-850">
                    <span className="block text-lg font-black text-orange-600 dark:text-orange-400">
                      {Math.floor(sessionTimeSpent / 60) > 0
                        ? `${Math.floor(sessionTimeSpent / 60)}m `
                        : ""}
                      {sessionTimeSpent % 60}s
                    </span>
                    <span className="text-[9px] uppercase font-bold opacity-60 block mt-0.5">
                      Thời gian
                    </span>
                  </div>
                  <div className="bg-background/40 p-2 rounded-xl border border-zinc-200/50 dark:border-zinc-850">
                    <span
                      className={cn(
                        "block text-lg font-black",
                        sessionMasteryGained >= 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-500",
                      )}
                    >
                      {sessionMasteryGained > 0 ? "+" : ""}
                      {sessionMasteryGained}
                    </span>
                    <span className="text-[9px] uppercase font-bold opacity-60 block mt-0.5">
                      Thông thạo
                    </span>
                  </div>
                  <div className="bg-background/40 p-2 rounded-xl border border-zinc-200/50 dark:border-zinc-850">
                    <span className="block text-lg font-black text-blue-600 dark:text-blue-400">
                      +{memoryProjection}%
                    </span>
                    <span className="text-[9px] uppercase font-bold opacity-60 block mt-0.5">
                      Ghi nhớ
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions list */}
              <div className="flex flex-col gap-3">
                {!deck?.id.startsWith("remind-later-") && (
                  <div className="flex gap-2">
                    <button
                      onClick={weakCardIds.length > 0 ? startReviewXCards : undefined}
                      disabled={weakCardIds.length === 0}
                      className={`flex-1 px-5 py-3.5 rounded-xl font-bold transition flex items-center justify-center gap-2 text-sm border ${
                        weakCardIds.length > 0
                          ? "bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500 hover:text-white border-red-500/20"
                          : "bg-zinc-200/50 text-zinc-400 dark:bg-zinc-800/50 dark:text-zinc-600 border-zinc-300/50 dark:border-zinc-700/50 cursor-not-allowed"
                      }`}
                    >
                      <X className="w-4 h-4" />
                      Ôn tập thẻ X ({weakCardIds.length})
                    </button>
                    <button
                      onClick={async (e) => {
                        try {
                          e.preventDefault();
                          const { set } = await import("idb-keyval");
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
                      }}
                      className="px-5 py-3.5 rounded-xl bg-zinc-300/60 dark:bg-zinc-800/80 font-bold hover:bg-black/20 dark:hover:bg-white/10 transition flex items-center justify-center gap-2 text-sm border border-zinc-400/20 dark:border-zinc-700/40 text-zinc-900 dark:text-zinc-100 cursor-pointer"
                      title="Lưu snapshot Thẻ X"
                    >
                      Lưu snapshot Thẻ X
                    </button>
                  </div>
                )}
                <button
                  onClick={startReviewAll}
                  className="w-full px-5 py-3.5 rounded-xl bg-zinc-300/60 dark:bg-zinc-800/80 font-bold hover:bg-black/20 dark:hover:bg-white/10 transition flex items-center justify-center gap-2 text-sm border border-zinc-400/20 dark:border-zinc-700/40 cursor-pointer"
                >
                  <RefreshCcw className="w-4 h-4 text-orange-500" />
                  Ôn tập lại từ đầu (Review All)
                </button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    try {
                      const existing = JSON.parse(localStorage.getItem("vibe_collected_ideas") || "[]");
                      if (existing.length === 0) {
                        toast("Sổ tay của bạn hiện đang trống.");
                        return;
                      }
                      const textToCopy = existing.join("\n\n");
                      navigator.clipboard.writeText(textToCopy).then(() => {
                        toast.success(`Đã copy ${existing.length} ý tưởng vào clipboard!`);
                      });
                    } catch (err) {
                      console.error(err);
                      toast.error("Lỗi khi copy sổ tay.");
                    }
                  }}
                  className="w-full px-5 py-3.5 rounded-xl bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-400 font-bold transition flex items-center justify-center gap-2 text-sm border border-amber-200/50 dark:border-amber-800/50 cursor-pointer"
                  title="Copy toàn bộ mẫu câu/ý tưởng bạn đã gom nhặt vào bộ nhớ đệm"
                >
                  <Copy className="w-4 h-4" />
                  Copy Sổ Tay Cá Nhân
                </button>
                <button
                  onClick={handleBack}
                  className="w-full px-5 py-3.5 rounded-xl bg-orange-500 text-black font-bold hover:bg-orange-600 transition shadow-lg flex items-center justify-center gap-2 text-sm border-none cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {isAdminMode ? "Trở về Admin View" : "Trở về Dashboard"}
                </button>
              </div>
            </div>

            {/* Right Column: Beautiful Interactive Session Progress Chart */}
            <div className="lg:col-span-7 bg-zinc-200/40 dark:bg-zinc-800/30 p-5 md:p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-350 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-orange-500" />
                  <h3 className="font-bold text-zinc-800 dark:text-zinc-100 text-base font-display">
                    Biểu Đồ Tiến Trình Phiên Học
                  </h3>
                </div>
                <div className="flex gap-1 bg-zinc-300/40 dark:bg-zinc-900/50 p-1 rounded-lg self-start">
                  <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400 px-2 py-1 font-mono uppercase bg-orange-500/10 rounded-md">
                    Chính Xác & Độ Thông Thạo
                  </span>
                </div>
              </div>

              {/* The Chart container */}
              <div className="h-64 sm:h-72 w-full">
                {sessionHistory.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={sessionHistory}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="accuracyGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#f59e0b"
                            stopOpacity={0.4}
                          />
                          <stop
                            offset="95%"
                            stopColor="#f59e0b"
                            stopOpacity={0.0}
                          />
                        </linearGradient>
                        <linearGradient
                          id="masteryGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#3b82f6"
                            stopOpacity={0.2}
                          />
                          <stop
                            offset="95%"
                            stopColor="#3b82f6"
                            stopOpacity={0.0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#888888"
                        strokeOpacity={0.1}
                      />
                      <XAxis
                        dataKey="cardIndex"
                        stroke="#888888"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        label={{
                          value: "Số thẻ học",
                          position: "insideBottom",
                          offset: -5,
                          fill: "#888888",
                          fontSize: 10,
                        }}
                      />
                      <YAxis
                        stroke="#888888"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        domain={[0, 100]}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "rgba(28, 25, 23, 0.95)",
                          borderColor: "#f59e0b",
                          borderRadius: "12px",
                          color: "#fff",
                          fontSize: "12px",
                        }}
                        formatter={(value: any, name: any, props: any) => {
                          if (name === "accuracy")
                            return [`${value}%`, "Độ chính xác tích lũy"];
                          if (name === "masteryChange")
                            return [
                              `${value > 0 ? "+" : ""}${value}`,
                              "Thay đổi thông thạo",
                            ];
                          return [value, name];
                        }}
                        labelFormatter={(label) =>
                          `Thẻ số ${label} (Mặt trước: "${sessionHistory[Number(label) - 1]?.front || ""}")`
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="accuracy"
                        stroke="#f59e0b"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#accuracyGrad)"
                        name="accuracy"
                      />
                      <Area
                        type="monotone"
                        dataKey="masteryChange"
                        stroke="#3b82f6"
                        strokeWidth={1.5}
                        fillOpacity={1}
                        fill="url(#masteryGrad)"
                        name="masteryChange"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full opacity-60 text-sm italic">
                    Không có đủ dữ liệu để dựng biểu đồ. Hãy thử học một vài thẻ
                    trước!
                  </div>
                )}
              </div>

              {/* Difficult Cards List */}
              <div className="space-y-4">
                <div className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wider flex items-center gap-2">
                  <X className="w-4 h-4" />
                  Thẻ Bạn Cần Ôn Tập Lại (Điểm Yếu)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {Array.from(new Map(sessionHistory.filter(item => item.status === "incorrect").map(item => [item.cardId, item])).values()).length > 0 ? (
                    Array.from(new Map(sessionHistory.filter(item => item.status === "incorrect").map(item => [item.cardId, item])).values())
                      .map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl text-sm flex flex-col justify-between border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 transition-colors"
                        >
                          <div className="flex justify-between font-bold opacity-70 mb-2 border-b border-red-500/10 pb-1 text-red-700 dark:text-red-400">
                            <span>Card #{item.cardIndex}</span>
                            <span className="uppercase text-[10px] tracking-widest border border-red-500/30 px-1.5 rounded-sm">
                              Ghi nhớ lại
                            </span>
                          </div>
                          <p
                            className="font-semibold text-zinc-800 dark:text-zinc-200 line-clamp-2"
                            title={item.front}
                          >
                            {item.front}
                          </p>
                        </div>
                      ))
                  ) : (
                    <div className="col-span-full p-4 text-center rounded-xl bg-green-500/10 border border-green-500/20 text-green-700 dark:text-green-400 text-sm font-medium">
                      Tuyệt vời! Bạn không gặp khó khăn với thẻ nào trong phiên
                      này.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {recommendedDecks.length > 0 && (
            <div className="pt-6 mt-6 border-t border-zinc-200 dark:border-zinc-800/60 space-y-4">
              <div className="text-lg font-bold font-display flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
                <BookOpen className="w-5 h-5 text-orange-500" />
                Học tiếp bộ thẻ cùng phân mục: {deck?.subject}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {recommendedDecks.map((rDeck: any) => (
                  <Link 
                    key={rDeck.id} 
                    to={`/study/${rDeck.id}`}
                    reloadDocument
                    className="p-4 rounded-2xl bg-zinc-100/80 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/50 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all group flex flex-col justify-between min-h-[120px] cursor-pointer"
                  >
                    <div>
                      <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-100 line-clamp-2 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                        {rDeck.title}
                      </h4>
                      <p className="text-xs text-zinc-500 mt-2 font-medium">
                        {rDeck.cards?.length || 0} thẻ
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs font-bold text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span>Học ngay</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-zinc-500 text-center max-w-md mx-auto p-4">
        <div className="text-4xl">🔒</div>
        <div className="text-lg font-bold text-zinc-800 dark:text-zinc-100 font-display">
          Quyền truy cập bị từ chối
        </div>
        <div className="text-sm text-zinc-500">
          Bộ học này là bộ thẻ cá nhân riêng tư. Chỉ người tạo mới được quyền
          truy cập học tập.
        </div>
        <button
          onClick={handleBack}
          className="mt-4 px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-500 hover:from-orange-600 hover:to-orange-600 text-black font-extrabold rounded-xl transition border-none cursor-pointer"
        >
          Quay lại
        </button>
      </div>
    );
  }

  if (isLoading)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-zinc-500">
        <div className="w-8 h-8 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
        <div>Đang tải phòng học...</div>
      </div>
    );

  if (!deck)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div>Không tìm thấy bộ thẻ (ID: {deckId || "undefined"}).</div>
        <button
          onClick={handleBack}
          className="px-6 py-2 rounded-lg bg-orange-500 text-black font-bold hover:bg-orange-600 transition border-none cursor-pointer"
        >
          {isAdminMode ? "Về Admin View" : "Về Dashboard"}
        </button>
      </div>
    );

  if (!currentCard || studyQueue.length === 0)
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div>No cards in this view.</div>
        <button
          onClick={startReviewAll}
          className="px-6 py-2 rounded-lg bg-orange-500 text-black font-bold hover:bg-orange-600 transition"
        >
          Quay lại bộ đầy đủ
        </button>
      </div>
    );

  
  return (
    <>
      <VibeClassModal isOpen={isClassModalOpen} onClose={() => setIsClassModalOpen(false)} deckIds={[deck?.id || ""]} />
      <EditDeckModal
        isOpen={isEditDeckModalOpen}
        onClose={() => setIsEditDeckModalOpen(false)}
        deckId={deck?.id || ""}
        initialTitle={typeof deck?.title === "string" ? deck.title : JSON.stringify(deck?.title || "")}
        initialSubject={typeof deck?.subject === "string" ? deck.subject : (deck?.subject ? JSON.stringify(deck.subject) : "general")}
        onSaveSuccess={() => {}}
      />
      <VibeFlashcardActiveView
        currentCard={currentCard}
        isFlipped={isFlipped}
        deck={deck}
        onFlip={handleFlip}
        onMark={handleMark}
        onRemindLater={handleRemindLater}
        currentIndex={currentIndex}
        totalCards={studyQueue.length}
        deckTitle={typeof deck?.title === "string" ? deck.title : JSON.stringify(deck?.title || "")}
        onBack={handleBack}
        onRestart={handleRestart}
        onPrevCard={handlePrevCard}
        correctCount={sessionCorrectCount}
        incorrectCount={sessionIncorrectCount}
        weakCardsCount={weakCardIds.length}
        onAddToClass={() => setIsClassModalOpen(true)}
        onEditDeckMetadata={canEditDeck ? () => setIsEditDeckModalOpen(true) : undefined}
        isSoundEnabled={isSoundEnabled}
        onToggleMute={handleToggleMute}
        onListen={handleListen}
        isExtracting={isExtracting}
        deepExplanation={deepExplanation}
        onAgent3={handleAgent3}
        onClearExplanation={() => { 
           if (!isPinned) setDeepExplanation(null); 
           else setIsMinimized(true); 
        }}
        isClozeMode={isClozeMode}
        onToggleClozeMode={() => {
          const newMode = !isClozeMode;
          setIsClozeMode(newMode);
          localStorage.setItem("study_cloze_mode", String(newMode));
        }}
        isHintRevealed={isHintRevealed}
        onToggleHint={() => setIsHintRevealed(true)}
        canEditDeck={canEditCurrentCard}
        onEditOpen={handleEditOpen}
        isEditing={isEditing}
        editFront={editFront}
        setEditFront={setEditFront}
        editBack={editBack}
        setEditBack={setEditBack}
        editExampleSentence={editExampleSentence}
        setEditExampleSentence={setEditExampleSentence}
        onSaveEdit={handleSaveEdit}
        onSaveFormattedCard={handleSaveFormattedCard}
        onDeleteCard={(e) => {
          e.stopPropagation();
          executeActiveCardDeletion();
        }}
        deleteCountdown={deleteCountdown}
        startDeleteCountdown={startDeleteCountdown}
        cancelDeleteCountdown={cancelDeleteCountdown}
        onTranslateDefinition={handleTranslateDefinitionRequest}
        isTranslatingDefinition={isTranslatingDefinition}
        detectLanguage={detectLanguage}
      />
      
      <ConfirmModal
        isOpen={!!confirmTranslateCardId}
        onClose={() => setConfirmTranslateCardId(null)}
        onConfirm={() => {
          if (confirmTranslateCardId) {
            executeTranslateDefinition(confirmTranslateCardId);
          }
        }}
        title="Dịch định nghĩa"
        message="Bạn có chắc chắn muốn AI tự động dịch phần định nghĩa tiếng Anh của thẻ này sang tiếng Việt không? Nội dung cũ sẽ bị thay thế."
        confirmText="Dịch ngay"
      />
    </>
  );
}
