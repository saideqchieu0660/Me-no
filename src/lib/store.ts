import { v4 as uuidv4 } from "uuid";
import { safeFetch } from "../utils/safeFetch";
import localforage from "localforage";

export type Role = "student" | "teacher" | "admin" | "Admin";

export interface User {
  id: string;
  name: string;
  email?: string;
  password?: string;
  role: Role;
  points: number; // For weekly ranking
  studyMinutes?: number;
  streak?: number;
  lastActiveDate?: string;
  streakFreeze?: boolean;
  streakFreezeCount?: number;
  isAnonymous?: boolean;
  status?: string;
  isPro?: boolean;
  isSchoolLover?: boolean;
  lastWeeklyResetWeek?: string; // Track which ISO calendar week they reset on
  
  doubleXPUntil?: number; // Timestamp for when the double XP ends
  hideRankUntil?: number; // Timestamp for when the anonymous rank mask ends
  argusEyesUntil?: number; // Timestamp for unlimited Detailed Mode
  achillesUntil?: number; // Timestamp for Achilles High Risk 3x XP multiplier
  
  // Profile UI Upgrades (Optional Fallbacks)
  level?: number;
  avatarBorder?: string;
  photoURL?: string;
  title?: string;
  unlockedCustomTitles?: string[];
  unlockedCustomBorders?: string[];
  
  averageMastery?: number; // Real-time overall average learning mastery (0 - 100)
  top1Weeks?: number; // Số tuần ngự trị ngôi vương Top 1

  activeChallenge?: {
    type: string;
    startDate: string;
    currentMultiplier: number;
    startStreak: number;
    targetDays: number;
    status: 'active' | 'failed' | 'completed';
  } | null;
  unitedEngineUses?: number;
}

export interface Flashcard {
  id: string;
  front: string;
  wordForm?: string; // e.g. noun, verb, adjective
  back: string;
  subject: string;
  mastery: number; // 0 to 100
  nextReview: number; // timestamp
  isHard: boolean; 
  interval?: number; // In days
  easeFactor?: number; // Default 2.5
  repetitionCount?: number; // Total consecutive successful reviews
  isNewCard?: boolean; // True if never reviewed yet
  nextReviewDate?: number; // Timestamp for next review
  originDeckId?: string;
  originDeckTitle?: string;
  example_sentence?: string;
  lastPointAwarded?: number;
  updatedAt?: string;
}

export interface ReviewRecord {
  id: string;
  userId: string;
  cardId: string;
  deckTitle: string;
  front: string;
  remembered: boolean;
  masteryChange: number;
  timestamp: number;
}

export interface Deck {
  id: string;
  title: string;
  subject: string;
  cards: Flashcard[];
  createdBy?: string;
  creatorRole?: string;
  creatorName?: string;
  createdAt?: number | string;
}

export interface StudyGroup {
  id: string;
  name: string;
  members: string[]; // user ids
}

let users: User[] = [
  { id: "student_1", name: "Marcus", password: "123", role: "student", points: 42, streak: 5, lastActiveDate: new Date().toISOString().split('T')[0] },
  { id: "student_2", name: "Seneca", password: "123", role: "student", points: 28, streak: 2, lastActiveDate: new Date(Date.now() - 86400000).toISOString().split('T')[0] },
  { id: "student_3", name: "Epictetus", password: "123", role: "student", points: 89, streak: 12, lastActiveDate: new Date().toISOString().split('T')[0] },
  { id: "student_4", name: "Aurelius", password: "123", role: "student", points: 55, streak: 4, lastActiveDate: new Date().toISOString().split('T')[0] },
  { id: "student_5", name: "Zeno", password: "123", role: "student", points: 15, streak: 1, lastActiveDate: new Date().toISOString().split('T')[0] },
  { id: "student_6", name: "Cleanthes", password: "123", role: "student", points: 120, streak: 21, lastActiveDate: new Date().toISOString().split('T')[0] },
  { id: "student_7", name: "Chrysippus", password: "123", role: "student", points: 76, streak: 8, lastActiveDate: new Date().toISOString().split('T')[0] },
];

let currentUser: User | null = null;
let reviewHistory: ReviewRecord[] = [];

let tempDecks: Record<string, any> = {};

let decks: Deck[] = [
  {
    id: "deck_test_50",
    title: "Test 50 Cards",
    subject: "test",
    cards: [
      { id: "card_test_1", front: "Front of Card 1", back: "Back of Card 1", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_2", front: "Front of Card 2", back: "Back of Card 2", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_3", front: "Front of Card 3", back: "Back of Card 3", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_4", front: "Front of Card 4", back: "Back of Card 4", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_5", front: "Front of Card 5", back: "Back of Card 5", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_6", front: "Front of Card 6", back: "Back of Card 6", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_7", front: "Front of Card 7", back: "Back of Card 7", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_8", front: "Front of Card 8", back: "Back of Card 8", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_9", front: "Front of Card 9", back: "Back of Card 9", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_10", front: "Front of Card 10", back: "Back of Card 10", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_11", front: "Front of Card 11", back: "Back of Card 11", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_12", front: "Front of Card 12", back: "Back of Card 12", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_13", front: "Front of Card 13", back: "Back of Card 13", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_14", front: "Front of Card 14", back: "Back of Card 14", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_15", front: "Front of Card 15", back: "Back of Card 15", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_16", front: "Front of Card 16", back: "Back of Card 16", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_17", front: "Front of Card 17", back: "Back of Card 17", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_18", front: "Front of Card 18", back: "Back of Card 18", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_19", front: "Front of Card 19", back: "Back of Card 19", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_20", front: "Front of Card 20", back: "Back of Card 20", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_21", front: "Front of Card 21", back: "Back of Card 21", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_22", front: "Front of Card 22", back: "Back of Card 22", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_23", front: "Front of Card 23", back: "Back of Card 23", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_24", front: "Front of Card 24", back: "Back of Card 24", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_25", front: "Front of Card 25", back: "Back of Card 25", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_26", front: "Front of Card 26", back: "Back of Card 26", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_27", front: "Front of Card 27", back: "Back of Card 27", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_28", front: "Front of Card 28", back: "Back of Card 28", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_29", front: "Front of Card 29", back: "Back of Card 29", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_30", front: "Front of Card 30", back: "Back of Card 30", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_31", front: "Front of Card 31", back: "Back of Card 31", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_32", front: "Front of Card 32", back: "Back of Card 32", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_33", front: "Front of Card 33", back: "Back of Card 33", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_34", front: "Front of Card 34", back: "Back of Card 34", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_35", front: "Front of Card 35", back: "Back of Card 35", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_36", front: "Front of Card 36", back: "Back of Card 36", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_37", front: "Front of Card 37", back: "Back of Card 37", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_38", front: "Front of Card 38", back: "Back of Card 38", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_39", front: "Front of Card 39", back: "Back of Card 39", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_40", front: "Front of Card 40", back: "Back of Card 40", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_41", front: "Front of Card 41", back: "Back of Card 41", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_42", front: "Front of Card 42", back: "Back of Card 42", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_43", front: "Front of Card 43", back: "Back of Card 43", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_44", front: "Front of Card 44", back: "Back of Card 44", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_45", front: "Front of Card 45", back: "Back of Card 45", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_46", front: "Front of Card 46", back: "Back of Card 46", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_47", front: "Front of Card 47", back: "Back of Card 47", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_48", front: "Front of Card 48", back: "Back of Card 48", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_49", front: "Front of Card 49", back: "Back of Card 49", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false },
      { id: "card_test_50", front: "Front of Card 50", back: "Back of Card 50", subject: "test", mastery: 0, nextReview: Date.now(), isHard: false }
    ]
  },

  {
    id: "deck_1",
    title: "Triết Học Khai Tâm",
    subject: "philosophy",
    cards: [
      { id: "card_1", front: "Amor Fati", back: "Yêu lấy định mệnh của mình.", subject: "philosophy", mastery: 95, nextReview: Date.now() + 86400000, isHard: false },
      { id: "card_2", front: "Memento Mori", back: "Hãy nhớ rằng bạn sẽ chết.", subject: "philosophy", mastery: 85, nextReview: Date.now() + 86400000, isHard: false },
    ]
  },
  {
    id: "deck_phil_2",
    title: "Triết Học Nâng Cao",
    subject: "philosophy",
    cards: [
      { id: "card_phil_1", front: "Eudaimonia", back: "Sự thăng hoa, hạnh phúc viên mãn.", subject: "philosophy", mastery: 20, nextReview: Date.now() - 50000, isHard: true },
      { id: "card_phil_2", front: "Prohairesis", back: "Năng lực lựa chọn.", subject: "philosophy", mastery: 10, nextReview: Date.now() - 50000, isHard: true },
    ]
  },
  {
    id: "deck_math_1",
    title: "Toán Dễ (Đại Số)",
    subject: "math",
    cards: [
      { id: "card_math_1", front: "Đạo hàm của x^2", back: "2x", subject: "math", mastery: 90, nextReview: Date.now() + 86400000, isHard: false },
      { id: "card_math_2", front: "Sin(30 độ)", back: "1/2", subject: "math", mastery: 100, nextReview: Date.now() + 86400000, isHard: false },
    ]
  },
  {
    id: "deck_math_2",
    title: "Toán Khó (Tích Phân)",
    subject: "math",
    cards: [
      { id: "card_math_3", front: "Nguyên hàm của cos(x)", back: "sin(x) + C", subject: "math", mastery: 0, nextReview: Date.now() - 10000, isHard: true },
    ]
  },
  {
    id: "deck_physics_1",
    title: "Vật Lý Cơ Bản",
    subject: "science",
    cards: [
      { id: "card_8", front: "Định luật 1 Newton", back: "Một vật đang đứng yên sẽ tiếp tục đứng yên...", subject: "science", mastery: 10, nextReview: Date.now() - 100000, isHard: true },
      { id: "card_9", front: "Công thức lực (Force)", back: "F = ma", subject: "science", mastery: 100, nextReview: Date.now() + 86400000*3, isHard: false },
    ]
  },
  {
    id: "deck_physics_2",
    title: "Vật Lý Lượng Tử",
    subject: "science",
    cards: [
      { id: "card_10", front: "Hằng số Planck", back: "6.626 x 10^-34 J.s", subject: "science", mastery: 0, nextReview: Date.now() - 100000, isHard: true },
    ]
  },
  {
    id: "deck_test_ui",
    title: "🧪 Bộ Thẻ Test Flashcard UI Updates",
    subject: "general",
    cards: [
      { 
        id: "card_test_1", 
        front: "Ephemeral", 
        back: "Tạm thời, ngắn ngủi, chóng tàn.\n\nVí dụ:\nLife is ephemeral, so enjoy every moment.\n\nGhi chú:\nXuất phát từ tiếng Hy Lạp 'ephemeros' (kéo dài trong một ngày).", 
        subject: "english", 
        mastery: 50, 
        nextReview: Date.now() - 1000, 
        isHard: false 
      },
      { 
        id: "card_test_2", 
        front: "Chế độ đục lỗ (Cloze Mode Test)", 
        back: "Artificial Intelligence (Trí tuệ nhân tạo) là ngành khoa học máy tính tái tạo trí thông minh của con người.", 
        example_sentence: "The developer used [Artificial Intelligence] to optimize the flashcard formatting and readability.",
        subject: "technology", 
        mastery: 70, 
        nextReview: Date.now() - 1000, 
        isHard: false 
      },
      { 
        id: "card_test_3", 
        front: "Nội dung rất dài & URL (Text Reflow Test)", 
        back: "Đây là một đoạn văn bản rất dài dùng để kiểm tra tính năng xuống dòng tự động (natural text wrapping) và scroll dọc trong Flashcard Card UI mà không gây tràn lề ngang (horizontal overflow).\n\nTruy cập tài liệu tại: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_text/Wrapping_and_breaking_text_for_long_urls_and_words_testing_extreme_length\n\nTừ Siêu Dài: Supercalifragilisticexpialidocious_and_another_extremely_long_unbroken_string_for_testing_word_break_overflow_prevention.", 
        subject: "technology", 
        mastery: 30, 
        nextReview: Date.now() - 1000, 
        isHard: true 
      }
    ]
  },
  {
    id: "deck_formatting_test",
    title: "🧪 Bộ Thẻ Test Formatting AI",
    subject: "test",
    cards: [
      {
        id: "card_fmt_1",
        front: "Câu hỏi 1: Thủ đô của Việt Nam?",
        back: "A.Hà NộiB.Đà NẵngC.TPHCMD.Cần Thơ",
        subject: "test",
        mastery: 0,
        nextReview: Date.now(),
        isHard: true
      },
      {
        id: "card_fmt_2",
        front: "Câu hỏi 2: Kết quả 2 + 2?",
        back: "1.Ba2.Bốn3.Năm4.Sáu",
        subject: "test",
        mastery: 0,
        nextReview: Date.now(),
        isHard: true
      }
    ]
  }
];

let groups: StudyGroup[] = [
  { id: "group_1", name: "Roman Scholars", members: ["student_1", "student_2", "student_4"] },
  { id: "group_2", name: "Physics Masters", members: ["student_3", "student_6", "student_7"] },
  { id: "group_3", name: "Stoic Circle", members: ["student_1", "student_3", "student_5", "student_7"] },
];

export function getISOWeekId(): string {
  const d = new Date();
  d.setUTCHours(0,0,0,0);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
}

const checkAndResetWeeklyPoints = () => {
  const currentWeek = getISOWeekId();
  const lastResetWeek = localStorage.getItem("lastWeeklyResetWeek");
  
  if (lastResetWeek !== currentWeek) {
    // Reset points
    users.forEach(u => {
      u.points = 0;
      u.lastWeeklyResetWeek = currentWeek;
    });
    if (currentUser) {
      currentUser.points = 0;
      currentUser.lastWeeklyResetWeek = currentWeek;
      syncUserToFirebase();
    }
    localStorage.setItem("lastWeeklyResetWeek", currentWeek);
    console.log(`Weekly points have been reset to 0 for week ${currentWeek}.`);
    
    // Kích hoạt dọn dẹp Firestore tự động tuần đầy đủ cho toàn hệ thống
    safeFetch("/api/automation/reset-weekly-points", { method: "POST" })
      .then(r => r.json())
      .then(d => {
        console.log("Auto-Reset Firebase Weekly Points response:", d);
      })
      .catch(err => {
        console.error("Auto-Reset Firebase Weekly Points failed:", err);
      });
  }
};

export function syncLocalUserDecks() {
  const userId = currentUser?.id || "guest";
  const localUserDecksKey = `local_user_decks_${userId}`;
  const savedStr = localStorage.getItem(localUserDecksKey);
  
  if (!currentUser) {
      // If logging out or guest, reset to system decks only
      const systemDecks = [
        "deck_1", "deck_phil_2", "deck_math_1", "deck_math_2", "deck_physics_1", "deck_physics_2", "deck_test_ui", "deck_formatting_test", "deck_test_50", "daily-quest", "remind-later-deck"
      ];
      decks = decks.filter(d => systemDecks.includes(d.id));
  }
  
  if (savedStr) {
    try {
      const loadedDecks: Deck[] = JSON.parse(savedStr);
      if (Array.isArray(loadedDecks)) {
         loadedDecks.forEach(customDeck => {
            const existingIdx = decks.findIndex(d => d.id === customDeck.id);
            if (existingIdx !== -1) {
                const existingDeck = decks[existingIdx];
                const mergedCards = existingDeck.cards.map(existingCard => {
                   const savedCard = customDeck.cards.find((c: any) => c.id === existingCard.id);
                   if (savedCard) {
                      return { 
                          ...existingCard,
                          mastery: savedCard.mastery ?? existingCard.mastery,
                          nextReview: savedCard.nextReview ?? existingCard.nextReview,
                          isHard: savedCard.isHard ?? existingCard.isHard,
                          interval: savedCard.interval ?? existingCard.interval,
                          easeFactor: savedCard.easeFactor ?? existingCard.easeFactor,
                          repetitionCount: savedCard.repetitionCount ?? existingCard.repetitionCount,
                          isNewCard: savedCard.isNewCard ?? existingCard.isNewCard,
                          nextReviewDate: savedCard.nextReviewDate ?? existingCard.nextReviewDate,
                          lastPointAwarded: savedCard.lastPointAwarded ?? existingCard.lastPointAwarded,
                          updatedAt: savedCard.updatedAt ?? existingCard.updatedAt
                      };
                   }
                   return existingCard;
                });
                
                customDeck.cards.forEach((savedCard: any) => {
                   if (!existingDeck.cards.some(c => c.id === savedCard.id)) {
                       mergedCards.push(savedCard);
                   }
                });

                decks[existingIdx] = { ...existingDeck, cards: mergedCards };
            } else {
                decks.push(customDeck);
            }
         });
      }
    } catch (e) {
      console.error("Failed to sync local user decks:", e);
    }
  }
}

export function saveReviewHistoryToLocal() {
  const userId = currentUser?.id;
  if (!userId) return;
  const key = `local_review_history_${userId}`;
  
  // Keep only the last 14 days to prevent storage bloat
  const cutoffTime = Date.now() - 14 * 24 * 60 * 60 * 1000;
  reviewHistory = reviewHistory.filter(r => r.timestamp >= cutoffTime);
  
  try {
    localforage.setItem(key, reviewHistory).catch(e => console.error("localforage save history Error:", e));
  } catch (e) {
    console.error("Failed to save review history locally:", e);
  }
}

export function loadReviewHistoryFromLocal() {
  const userId = currentUser?.id;
  if (!userId) {
     reviewHistory = [];
     return;
  }
  const key = `local_review_history_${userId}`;
  
  try {
    localforage.getItem(key).then((data: unknown) => {
        if (data && Array.isArray(data)) {
            // Merge loaded data with any in-memory data that might have happened during loading
            const merged = [...reviewHistory, ...(data as ReviewRecord[])];
            
            // Re-deduplicate just in case
            const uniqueMap = new Map();
            merged.forEach(item => uniqueMap.set(item.id, item));
            
            reviewHistory = Array.from(uniqueMap.values());
            
            // Keep only the last 14 days
            const cutoffTime = Date.now() - 14 * 24 * 60 * 60 * 1000;
            reviewHistory = reviewHistory.filter(r => r.timestamp >= cutoffTime);
        }
    }).catch(e => console.error("localforage get history Error:", e));
  } catch (e) {
    console.error("Failed to load review history locally:", e);
  }
}

export function saveLocalUserDecks() {
  const userId = currentUser?.id || "guest";
  const localUserDecksKey = `local_user_decks_${userId}`;
  const userCustomDecks = decks.filter(d => !d.id.startsWith("remind-later-"));
  try {
    localStorage.setItem(localUserDecksKey, JSON.stringify(userCustomDecks));
  } catch (e) {
    console.error("Failed to save local user decks:", e);
  }
}

checkAndResetWeeklyPoints();
try {
  syncLocalUserDecks();
} catch (err) {
  console.warn("Storage not available during module initialization:", err);
}

const updateStreak = (user: User) => {
  const today = new Date().toISOString().split('T')[0];
  if (user.lastActiveDate === today) {
    return;
  }
  if (user.lastActiveDate) {
    const lastActive = new Date(user.lastActiveDate);
    const current = new Date(today);
    const diffDays = Math.round(Math.abs(current.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      user.streak = (user.streak || 0) + 1;
    } else if (diffDays === 2 && user.streakFreeze) {
      user.streakFreeze = false;
      // Streak maintained, not reset, not increased
    } else if (diffDays > 1) {
      if (user.activeChallenge?.status === 'active') {
        user.activeChallenge.status = 'failed';
        user.points = Math.max(0, user.points - (600 * user.activeChallenge.currentMultiplier));
      }
      user.streak = 1;
    }
  } else {
    // If no last active date, streak starts at 1
    if (user.activeChallenge?.status === 'active') {
        user.activeChallenge.status = 'failed';
        user.points = Math.max(0, user.points - (600 * user.activeChallenge.currentMultiplier));
    }
    user.streak = 1;
  }
  user.lastActiveDate = today;

  // Check challenge completion after updating streak
  if (user.activeChallenge?.status === 'active') {
    const target = user.activeChallenge.startStreak + user.activeChallenge.targetDays;
    if ((user.streak || 0) >= target) {
      user.activeChallenge.status = 'completed';
    }
  }
};

export async function syncUserToFirebase() {
  if (currentUser) {
    try {
      // PRE-FLIGHT VALIDATION: Only cache and queue if it's a valid data block
      if (typeof currentUser.points === 'number' && currentUser.role) {
          import('../utils/offlineDb').then(({ saveProfileMetaOffline }) => {
            saveProfileMetaOffline(currentUser!.id, currentUser).catch(console.warn);
          });
      }
      
      const { auth } = await import('./firebase');
      if (auth.currentUser?.isAnonymous || currentUser.isAnonymous || !currentUser.email) return; // Never sync anonymous users
      
      const payload = {
        name: currentUser.name,
        role: currentUser.role,
        points: currentUser.points,
        streak: currentUser.streak || 1,
        lastActiveDate: currentUser.lastActiveDate || new Date().toISOString().split('T')[0],
        streakFreeze: !!currentUser.streakFreeze,
        streakFreezeCount: currentUser.streakFreezeCount || 0,
        isAnonymous: auth.currentUser?.isAnonymous || false,
        isSchoolLover: !!currentUser.isSchoolLover,
        doubleXPUntil: currentUser.doubleXPUntil || 0,
        hideRankUntil: currentUser.hideRankUntil || 0,
        argusEyesUntil: currentUser.argusEyesUntil || 0,
        achillesUntil: currentUser.achillesUntil || 0,
        averageMastery: currentUser.averageMastery || 0,
        top1Weeks: currentUser.top1Weeks || 0,
        level: currentUser.level || 1,
        avatarBorder: currentUser.avatarBorder || "none",
        title: currentUser.title || "",
        unlockedCustomTitles: currentUser.unlockedCustomTitles || [],
        unlockedCustomBorders: currentUser.unlockedCustomBorders || [],
        photoURL: currentUser.photoURL || "",
        ...(currentUser.activeChallenge && { activeChallenge: currentUser.activeChallenge }),
        ...(currentUser.unitedEngineUses !== undefined && { unitedEngineUses: currentUser.unitedEngineUses })
      };

      import('../vibe-sandbox/sync/VibeSyncEngine').then(({ VibeSyncEngine }) => {
        VibeSyncEngine.saveProfile(currentUser!.id, payload);
      }).catch(e => console.error("OfflineSync Profile enqueue error:", e));
    } catch (e) {
      console.error("Failed to sync currentUser to Firebase:", e);
    }
  }
}

export const store = {
  getUsers: () => users,
  getCurrentUser: () => {
    if (currentUser) updateStreak(currentUser);
    return currentUser;
  },
  setFirebaseUser: async (firebaseUser: any) => {
    if (!firebaseUser) {
        currentUser = null;
        return;
    }
    const email = firebaseUser.email || "User";
    const name = email.split('@')[0];
    let u = users.find(x => x.name === name);
    if (!u) {
       let cachedU = null;
       try { 
         const { getProfileMetaOffline } = await import('../utils/offlineDb');
         cachedU = await getProfileMetaOffline(firebaseUser.uid);
       } catch (e) {
         console.warn("Failed to load cached profile from IndexedDB:", e);
       }
       
       if (cachedU && cachedU.role) {
           u = { ...cachedU, id: firebaseUser.uid, name, isAnonymous: firebaseUser.isAnonymous || false, email: firebaseUser.email || "" };
       } else {
           u = { id: firebaseUser.uid, name, role: "student", points: 0, streak: 1, lastActiveDate: new Date().toISOString().split('T')[0], isAnonymous: firebaseUser.isAnonymous || false, email: firebaseUser.email || "" };
       }
       users.push(u);
    }
    currentUser = u;
    loadReviewHistoryFromLocal();
    u.photoURL = firebaseUser.photoURL || u.photoURL || "";

    // Architecture 3: Trích xuất và Hydrate CardState cho user
    try {
        const { dbService, db, handleFirestoreError, OperationType } = await import('./firebase');
        const { collection, getDocs, setDoc, doc } = await import('firebase/firestore');

        // Lấy profile từ Firestore
        let profile = await dbService.getUserProfile(firebaseUser.uid);
        
        // CHECK PENDING QUEUE: If the user was offline and made changes, the queue has the freshest data
        try {
           const pendingItems = JSON.parse(localStorage.getItem("costudy_offline_sync_queue") || "[]");
           
           // Apply latest profile changes (like streakFreeze, etc.) with MONOTONIC MERGE and SET UNION
           const latestPendingProfile = pendingItems.slice().reverse().find((i: any) => i.type === "userProfile" && i.uid === firebaseUser.uid);
           if (latestPendingProfile && latestPendingProfile.payload) {
              console.warn("Hydrating from PENDING QUEUE payload with Monotonic protections applied.");
              
              const payload = latestPendingProfile.payload;
              const cloudRole = profile?.role || "student";
              const localRole = payload.role || "student";
              const mergedRole = (cloudRole === "Admin" || cloudRole === "admin" || cloudRole === "teacher") ? cloudRole : localRole;

              const mergedBorders = [...new Set([...(payload.unlockedCustomBorders || []), ...(profile?.unlockedCustomBorders || [])])];
              const mergedTitles  = [...new Set([...(payload.unlockedCustomTitles || []), ...(profile?.unlockedCustomTitles || [])])];
              
              const mergedXP = Math.max((profile?.points || 0), (payload.points || 0));
              const mergedLevel = Math.max((profile?.level || 1), (payload.level || 1));
              const mergedStreak = Math.max((profile?.streak || 0), (payload.streak || 0));

              profile = { 
                 ...profile, 
                 ...payload,
                 role: mergedRole,
                 points: mergedXP,
                 level: mergedLevel,
                 streak: mergedStreak,
                 unlockedCustomBorders: mergedBorders,
                 unlockedCustomTitles: mergedTitles
              };
           }
           
           // Apply pending points delta (only those that occurred AFTER the latest userProfile payload, if any)
           let pendingPoints = 0;
           const latestProfileIndex = pendingItems.slice().reverse().findIndex((i: any) => i.type === "userProfile" && i.uid === firebaseUser.uid);
           const actualIndex = latestProfileIndex >= 0 ? pendingItems.length - 1 - latestProfileIndex : -1;
           
           pendingItems.forEach((i: any, index: number) => {
               if (index > actualIndex && i.type === "pointsDelta" && i.uid === firebaseUser.uid) {
                   pendingPoints += (i.payload.delta || 0);
               }
           });
           
           if (pendingPoints > 0) {
              profile.points = (profile.points || 0) + pendingPoints;
           }
        } catch(e) {
           console.error("Failed to check offline sync queue during hydration:", e);
        }
        
        if (profile) {
            // Check and update email for linked or existing accounts
            if (!firebaseUser.isAnonymous && firebaseUser.email && profile.email !== firebaseUser.email) {
                await dbService.updateUserProfile(firebaseUser.uid, {
                    email: firebaseUser.email
                });
            }

            import('../utils/offlineDb').then(({ saveProfileMetaOffline }) => {
                saveProfileMetaOffline(firebaseUser.uid, profile).catch(console.warn);
            });
            let sessionRole = profile.role || "student";
            if (sessionRole === "Admin" || sessionRole === "admin") {
                sessionStorage.setItem('adminToken', 'true');
            }
            if (sessionRole === "teacher" && sessionStorage.getItem('adminToken') !== 'true') {
                sessionRole = "student";
            }
            if (sessionStorage.getItem('adminToken') === 'true') {
                if (sessionRole !== "Admin" && sessionRole !== "admin") {
                    sessionRole = "teacher";
                }
            }
            if (sessionRole) u.role = sessionRole as any;
            if (typeof profile.isPro === 'boolean') u.isPro = profile.isPro;
            if (typeof profile.isSchoolLover === 'boolean') u.isSchoolLover = profile.isSchoolLover;
            if (profile.title) u.title = profile.title;
            if (profile.avatarBorder) u.avatarBorder = profile.avatarBorder;
            if (profile.photoURL) u.photoURL = profile.photoURL;
            if (profile.unlockedCustomTitles) u.unlockedCustomTitles = profile.unlockedCustomTitles;
            if (profile.unlockedCustomBorders) u.unlockedCustomBorders = profile.unlockedCustomBorders;
            
            // Calendric Weekly Points Reset Check
            const currentWeek = getISOWeekId();
            const lastResetWeek = profile.lastWeeklyResetWeek || "";
            if (lastResetWeek !== currentWeek) {
                u.points = 0;
                u.lastWeeklyResetWeek = currentWeek;
                if (!firebaseUser.isAnonymous) {
                    await dbService.updateUserProfile(firebaseUser.uid, {
                        points: 0,
                        lastWeeklyResetWeek: currentWeek
                    });
                }
                // Đồng thời kích hoạt dọn dẹp Firestore tự động tuần đầy đủ cho toàn hệ thống
                safeFetch("/api/automation/reset-weekly-points", { method: "POST" })
                  .then(r => r.json())
                  .then(d => console.log("System-wide keypoints reset:", d))
                  .catch(err => console.error("System-wide keypoints reset failed:", err));
            } else {
                if (typeof profile.points === 'number') u.points = profile.points;
                if (profile.lastWeeklyResetWeek) u.lastWeeklyResetWeek = profile.lastWeeklyResetWeek;
            }
            
            if (typeof profile.streak === 'number') u.streak = profile.streak;
            if (profile.lastActiveDate) u.lastActiveDate = profile.lastActiveDate;
            if (typeof profile.streakFreeze === 'boolean') u.streakFreeze = profile.streakFreeze;
            if (typeof profile.streakFreezeCount === 'number') u.streakFreezeCount = profile.streakFreezeCount;
            if (typeof profile.doubleXPUntil === 'number') u.doubleXPUntil = profile.doubleXPUntil;
            if (typeof profile.hideRankUntil === 'number') u.hideRankUntil = profile.hideRankUntil;
            if (typeof profile.argusEyesUntil === 'number') u.argusEyesUntil = profile.argusEyesUntil;
            if (typeof profile.achillesUntil === 'number') u.achillesUntil = profile.achillesUntil;
            if (typeof profile.averageMastery === 'number') u.averageMastery = profile.averageMastery;
            if (typeof profile.top1Weeks === 'number') u.top1Weeks = profile.top1Weeks;
            if (profile.activeChallenge) u.activeChallenge = profile.activeChallenge;
            if (typeof profile.unitedEngineUses === 'number') u.unitedEngineUses = profile.unitedEngineUses;
        } else {
            // Chưa có profile trên firestore, lưu quả profile mặc định đầu tiên lên (chỉ người dùng thật)
            if (!firebaseUser.isAnonymous) {
              const currentWeek = getISOWeekId();
              u.lastWeeklyResetWeek = currentWeek;
              await dbService.updateUserProfile(firebaseUser.uid, {
                 name: u.name,
                 email: firebaseUser.email || "No Email linked",
                 role: u.role,
                 points: u.points,
                 streak: u.streak,
                 lastActiveDate: u.lastActiveDate,
                 streakFreeze: !!u.streakFreeze,
                 streakFreezeCount: u.streakFreezeCount || 0,
                 doubleXPUntil: u.doubleXPUntil || 0,
                 hideRankUntil: u.hideRankUntil || 0,
                 isAnonymous: false,
                 isPro: !!u.isPro,
                 lastWeeklyResetWeek: currentWeek
              });
            }
        }

        // Chạy updateStreak lúc đăng nhập một cách an toàn và đồng bộ ngược lên db nếu đổi
        const oldStreak = u.streak;
        updateStreak(u);
        if (u.streak !== oldStreak) {
           if (!firebaseUser.isAnonymous) {
              await dbService.updateUserProfile(firebaseUser.uid, {
                 streak: u.streak,
                 lastActiveDate: u.lastActiveDate
              });
           }
        }

        // Hydrate Sets from Firestore
        try {
            const { withTimeout } = await import('./firebase');
            const { query, where, getDoc, doc } = await import('firebase/firestore');
            const setsCol = collection(db, "sets");
            
            // OPTIMIZATION: Only fetch user's own decks to avoid Full Table Scan
            const q = query(setsCol, where("createdBy", "==", u.id));
            let setsSnapshot = await withTimeout(getDocs(q), 6000, { empty: true, forEach: () => {} } as any);
            
            if (setsSnapshot.empty && setsSnapshot.forEach) {
                // Seed standard static decks into Firestore
                const defaultDecks = [
                  {
                    id: "deck_1",
                    title: "Triết Học Khai Tâm",
                    subject: "philosophy",
                    cards: [
                      { id: "card_1", front: "Amor Fati", back: "Yêu lấy định mệnh của mình.", subject: "philosophy", mastery: 95, nextReview: Date.now() + 86400000, isHard: false },
                      { id: "card_2", front: "Memento Mori", back: "Hãy nhớ rằng bạn sẽ chết.", subject: "philosophy", mastery: 85, nextReview: Date.now() + 86400000, isHard: false },
                    ]
                  },
                  {
                    id: "deck_phil_2",
                    title: "Triết Học Nâng Cao",
                    subject: "philosophy",
                    cards: [
                      { id: "card_phil_1", front: "Eudaimonia", back: "Sự thăng hoa, hạnh phúc viên mãn.", subject: "philosophy", mastery: 20, nextReview: Date.now() - 50000, isHard: true },
                      { id: "card_phil_2", front: "Prohairesis", back: "Năng lực lựa chọn.", subject: "philosophy", mastery: 10, nextReview: Date.now() - 50000, isHard: true },
                    ]
                  },
                  {
                    id: "deck_math_1",
                    title: "Toán Dễ (Đại Số)",
                    subject: "math",
                    cards: [
                      { id: "card_math_1", front: "Đạo hàm của x^2", back: "2x", subject: "math", mastery: 90, nextReview: Date.now() + 86400000, isHard: false },
                      { id: "card_math_2", front: "Sin(30 độ)", back: "1/2", subject: "math", mastery: 100, nextReview: Date.now() + 86400000, isHard: false },
                    ]
                  },
                  {
                    id: "deck_math_2",
                    title: "Toán Khó (Tích Phân)",
                    subject: "math",
                    cards: [
                      { id: "card_math_3", front: "Nguyên hàm của cos(x)", back: "sin(x) + C", subject: "math", mastery: 0, nextReview: Date.now() - 10000, isHard: true },
                    ]
                  },
                  {
                    id: "deck_physics_1",
                    title: "Vật Lý Cơ Bản",
                    subject: "science",
                    cards: [
                      { id: "card_8", front: "Định luật 1 Newton", back: "Một vật đang đứng yên sẽ tiếp tục đứng yên...", subject: "science", mastery: 10, nextReview: Date.now() - 100000, isHard: true },
                      { id: "card_9", front: "Công thức lực (Force)", back: "F = ma", subject: "science", mastery: 100, nextReview: Date.now() + 86400000*3, isHard: false },
                    ]
                  },
                  {
                    id: "deck_physics_2",
                    title: "Vật Lý Lượng Tử",
                    subject: "science",
                    cards: [
                      { id: "card_10", front: "Hằng số Planck", back: "6.626 x 10^-34 J.s", subject: "science", mastery: 0, nextReview: Date.now() - 100000, isHard: true },
                    ]
                  },
                  {
                    id: "deck_test_ui",
                    title: "🧪 Bộ Thẻ Test Flashcard UI Updates",
                    subject: "general",
                    cards: [
                      { 
                        id: "card_test_1", 
                        front: "Ephemeral", 
                        back: "Tạm thời, ngắn ngủi, chóng tàn.\n\nVí dụ:\nLife is ephemeral, so enjoy every moment.\n\nGhi chú:\nXuất phát từ tiếng Hy Lạp 'ephemeros' (kéo dài trong một ngày).", 
                        subject: "english", 
                        mastery: 50, 
                        nextReview: Date.now() - 1000, 
                        isHard: false 
                      },
                      { 
                        id: "card_test_2", 
                        front: "Chế độ đục lỗ (Cloze Mode Test)", 
                        back: "Artificial Intelligence (Trí tuệ nhân tạo) là ngành khoa học máy tính tái tạo trí thông minh của con người.", 
                        example_sentence: "The developer used [Artificial Intelligence] to optimize the flashcard formatting and readability.",
                        subject: "technology", 
                        mastery: 70, 
                        nextReview: Date.now() - 1000, 
                        isHard: false 
                      },
                      { 
                        id: "card_test_3", 
                        front: "Nội dung rất dài & URL (Text Reflow Test)", 
                        back: "Đây là một đoạn văn bản rất dài dùng để kiểm tra tính năng xuống dòng tự động (natural text wrapping) và scroll dọc trong Flashcard Card UI mà không gây tràn lề ngang (horizontal overflow).\n\nTruy cập tài liệu tại: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_text/Wrapping_and_breaking_text_for_long_urls_and_words_testing_extreme_length\n\nTừ Siêu Dài: Supercalifragilisticexpialidocious_and_another_extremely_long_unbroken_string_for_testing_word_break_overflow_prevention.", 
                        subject: "technology", 
                        mastery: 30, 
                        nextReview: Date.now() - 1000, 
                        isHard: true 
                      }
                    ]
                  }
                ];

                for (const d of defaultDecks) {
                    await setDoc(doc(db, "sets", d.id), d);
                }
                setsSnapshot = await getDocs(q);
            }
            
            // Bổ sung Load riêng các bộ bài của hệ thống (System Decks)
            const systemDecksList = [
              "deck_1", "deck_phil_2", "deck_math_1", "deck_math_2", "deck_physics_1", "deck_physics_2", "deck_test_ui", "deck_formatting_test", "deck_test_50"
            ];
            const extraSystemDecks = [];
            for (const sysId of systemDecksList) {
               try {
                  const docSnap = await getDoc(doc(db, "sets", sysId));
                  if (docSnap.exists()) extraSystemDecks.push(docSnap.data());
               } catch(e) {}
            }

            const fbDecks: Deck[] = [];
            setsSnapshot.forEach(docSnap => {
                const deckData = docSnap.data() as any;
                if (deckData && Array.isArray(deckData.cards)) {
                    deckData.cards = deckData.cards.map((c: any) => ({
                        ...c,
                        mastery: (typeof c.mastery === 'number' && !isNaN(c.mastery)) ? c.mastery : 0
                    }));
                }
                
                const systemDecks = [
                  "deck_1", "deck_phil_2", "deck_math_1", "deck_math_2", "deck_physics_1", "deck_physics_2", "deck_test_ui", "deck_formatting_test", "deck_test_50"
                ];
                const isSystem = systemDecks.includes(deckData.id);
                const isCreatedBySelf = deckData.createdBy === u.id;
                const isCreatedByTeacher = deckData.creatorRole === "teacher" || deckData.creatorRole === "Admin" || deckData.creatorRole === "admin";
                
                const isUserTeacher = u.role === "teacher" || u.role === "Admin" || u.role === "admin";

                // Personal decks should only be loaded/visible if system deck, created by self, creator is admin/teacher, or logged-in user is admin/teacher.
                if (isSystem || isCreatedBySelf || isUserTeacher || isCreatedByTeacher) {
                  fbDecks.push(deckData as Deck);
                }
            });
            
            // Append system decks that were fetched separately
            extraSystemDecks.forEach(deckData => {
                if (deckData && Array.isArray(deckData.cards)) {
                    deckData.cards = deckData.cards.map((c: any) => ({
                        ...c,
                        mastery: (typeof c.mastery === 'number' && !isNaN(c.mastery)) ? c.mastery : 0
                    }));
                }
                if (!fbDecks.find(d => d.id === deckData.id)) {
                   fbDecks.push(deckData as Deck);
                }
            });
            if (fbDecks.length > 0) {
                decks = fbDecks;
            }
        } catch (setErr) {
            console.error("Failed to load sets from Firestore, fallback to static decks", setErr);
        }
        
        try {
            const { getAllOfflineDecks } = await import('../utils/offlineDb');
            const offlineCourses = await getAllOfflineDecks();
            if (offlineCourses.length > 0) {
                // Merge without duplicating
                offlineCourses.forEach((offDeck: any) => {
                    const exists = decks.findIndex(d => d.id === offDeck.id);
                    if (exists !== -1) {
                        decks[exists] = offDeck; // Override with offline version (it has isAvailableOffline flag)
                    } else {
                        decks.push(offDeck as Deck);
                    }
                });
            }
        } catch (offlineReadErr) {
            console.warn("Failed to read offline courses during hydration:", offlineReadErr);
        }

        let states: any[] = [];
        try {
            states = await dbService.getAllCardStates(firebaseUser.uid) || [];
        } catch(e: any) {
            console.warn("Failed to fetch cloud card states, relying on pending offline sync items:", e);
        }

        const stateMap = new Map();
        states.forEach((s: any) => stateMap.set(s.id, s));
        
        try {
           const pendingItems = JSON.parse(localStorage.getItem("costudy_offline_sync_queue") || "[]");
           pendingItems.forEach((i: any) => {
              if (i.type === "cardState" && i.uid === firebaseUser.uid && i.cardId) {
                 stateMap.set(i.cardId, { ...stateMap.get(i.cardId), ...i.payload });
              }
           });
        } catch(e) {
           console.error("Failed to merge offline card states:", e);
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

        // Loop through default local decks and update flashcards memory
        decks.forEach(deck => {
            deck.cards.forEach(card => {
                const savedState = stateMap.get(card.id);
                if (savedState) {
                    const cardTs = getCardTimestamp(card);
                    const savedTs = getCardTimestamp(savedState);
                    
                    if (savedTs >= cardTs) {
                        card.mastery = typeof savedState.mastery === 'number' && !isNaN(savedState.mastery) ? savedState.mastery : (Number(card.mastery) || 0);
                        card.nextReviewDate = typeof savedState.nextReviewDate === 'number' ? savedState.nextReviewDate : (typeof savedState.nextReview === 'number' ? savedState.nextReview : card.nextReviewDate);
                        card.nextReview = card.nextReviewDate || card.nextReview; // Legacy sync
                        card.interval = typeof savedState.interval === 'number' ? savedState.interval : card.interval;
                        card.repetitionCount = typeof savedState.repetitionCount === 'number' ? savedState.repetitionCount : (typeof savedState.repetition === 'number' ? savedState.repetition : card.repetitionCount);
                        card.easeFactor = typeof savedState.easeFactor === 'number' ? savedState.easeFactor : (typeof savedState.efactor === 'number' ? savedState.efactor : card.easeFactor);
                        card.isNewCard = typeof savedState.isNewCard === 'boolean' ? savedState.isNewCard : false; // If it's saved in state it's no longer new
                        card.isHard = typeof savedState.isWeakCard !== 'undefined' ? savedState.isWeakCard : card.isHard;
                        if (savedState.updatedAt) card.updatedAt = savedState.updatedAt;
                    }
                }
            });
        });
    } catch (e: any) {
        if (!navigator.onLine || e?.message?.includes('client is offline') || e?.message?.includes('Failed to load sets from Firestore')) {
            console.warn("Firebase client is offline: loading offline courses from IndexedDB.");
            try {
                const { getAllOfflineDecks } = await import('../utils/offlineDb');
                const offlineCourses = await getAllOfflineDecks();
                if (offlineCourses.length > 0) {
                    offlineCourses.forEach((offDeck: any) => {
                        const exists = decks.findIndex(d => d.id === offDeck.id);
                        if (exists !== -1) {
                            decks[exists] = offDeck;
                        } else {
                            decks.push(offDeck as Deck);
                        }
                    });
                }
            } catch (err) {
                console.error("Failed to load offline courses:", err);
            }
        } else {
            console.error("Failed to hydrate cards state from Firebase:", e);
        }
    }
    syncLocalUserDecks();
    // Kích hoạt đồng bộ các thay đổi offline tích lũy của user nếu có
    import('../vibe-sandbox/sync/VibeSyncEngine').then(({ VibeSyncEngine }) => {
        VibeSyncEngine.syncNow();
    }).catch(err => console.error("Error trigger queue processing during setFirebaseUser:", err));
  },
  logout: () => { 
    currentUser = null; 
    sessionStorage.removeItem('adminToken');
    syncLocalUserDecks();
  },
  updateCurrentUser: (updates: Partial<User>, skipSync?: boolean, silent?: boolean) => {
    if (currentUser) {
      currentUser = { ...currentUser, ...updates };
      const idx = users.findIndex(u => u.id === currentUser?.id);
      if (idx >= 0) {
        users[idx] = { ...users[idx], ...updates };
      }
      import('../utils/offlineDb').then(({ saveProfileMetaOffline }) => {
          saveProfileMetaOffline(currentUser!.id, currentUser).catch(console.warn);
      });
      if (!skipSync) {
        syncUserToFirebase();
      }
      
      // Global UI Reactive State Event to force-trigger DOM re-renders across the app
      if (typeof window !== 'undefined' && !silent) {
        window.dispatchEvent(new CustomEvent("henosis-data-synced"));
        window.dispatchEvent(new CustomEvent("user-cosmetics-updated"));
      }
    }
  },
  signup: (name: string, password: string, adminKey?: string) => {
    if (users.find(x => x.name === name)) return null; // already exists
    
    let role: Role = "student";
    let isPro = false;
    
    const isFirebaseConnected = !!import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_API_KEY !== "DUMMY_KEY_FOR_INIT";
    const correctAdminKey = isFirebaseConnected 
      ? (import.meta.env.VITE_ADMIN_KEY || "disabled_in_client_use_backend")
      : "seneca";
      
    const proKey = "disabled_in_client_use_backend_pro";
    if (adminKey && adminKey === correctAdminKey) {
       role = "teacher";
    } else if (adminKey && adminKey === proKey) {
       isPro = true;
    }

    const u: User = { id: `user_${uuidv4()}`, name, password, role, isPro, points: 0, streak: 1, lastActiveDate: new Date().toISOString().split('T')[0] };
    users.push(u);
    currentUser = u;
    syncLocalUserDecks();
    loadReviewHistoryFromLocal();
    return u;
  },
  login: (name: string, password?: string, adminKey?: string) => {
    let u = users.find(x => x.name === name);
    
    if (u && password && u.password !== password) {
      return null; // invalid password
    }

    if (u) {
       // if they provided correct admin key, upgrade them
       const isFirebaseConnected = !!import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_API_KEY !== "DUMMY_KEY_FOR_INIT";
       const correctAdminKey = isFirebaseConnected 
         ? (import.meta.env.VITE_ADMIN_KEY || "disabled_in_client_use_backend")
         : "seneca";
         
       const proKey = "disabled_in_client_use_backend_pro";
       if (adminKey && adminKey === correctAdminKey) {
          u.role = "teacher";
       } else if (adminKey && adminKey === proKey) {
          u.isPro = true;
       }
       currentUser = u;
       syncLocalUserDecks();
       loadReviewHistoryFromLocal();
     }
    
    return u;
  },
  getDecks: () => {
    const systemDecks = [
      "deck_1", "deck_phil_2", "deck_math_1", "deck_math_2", "deck_physics_1", "deck_physics_2", "deck_test_ui", "deck_formatting_test", "deck_test_50", "daily-quest", "remind-later-deck"
    ];
    let filteredDecks: Deck[] = [];
    if (!currentUser) {
      filteredDecks = decks.filter(d => systemDecks.includes(d.id));
    } else {
      const isUserTeacher = currentUser.role === "teacher" || currentUser.role === "Admin" || currentUser.role === "admin";
      filteredDecks = decks.filter(d => {
        if (d.id.startsWith("remind-later-")) return false;
        const isSystem = systemDecks.includes(d.id);
        if (isSystem) return false;
        
        const isCreatedBySelf = d.createdBy === currentUser.id;
        const isCreatedByTeacher = d.creatorRole === "teacher" || d.creatorRole === "Admin" || d.creatorRole === "admin";
        
        if (isUserTeacher || isCreatedBySelf || isCreatedByTeacher) {
          return true;
        }
        return false;
      });
    }

    // Deduplicate by deck ID to guarantee unique React keys
    const seenIds = new Set<string>();
    const uniqueDecks: Deck[] = [];
    for (const d of filteredDecks) {
      if (d && d.id) {
        if (!seenIds.has(d.id)) {
          seenIds.add(d.id);
          uniqueDecks.push(d);
        }
      }
    }
    return uniqueDecks;
  },
  setTempDeck: (deck: any) => {
    tempDecks[deck.id] = deck;
    decks = decks.filter(d => d.id !== deck.id);
    decks.push(deck);
  },
  getRawDeckTitle: (id: string) => {
    const d = tempDecks[id] || decks.find(d => d.id === id);
    return d ? d.title : undefined;
  },
  getDeck: (id: string) => {
    const d = tempDecks[id] || decks.find(d => d.id === id);
    if (!d) return undefined;
    const systemDecks = [
      "deck_1", "deck_phil_2", "deck_math_1", "deck_math_2", "deck_physics_1", "deck_physics_2", "deck_test_ui", "deck_formatting_test", "deck_test_50", "daily-quest", "remind-later-deck"
    ];
    if (systemDecks.includes(d.id)) {
      if (currentUser) return undefined;
      return d;
    }
    if (!currentUser) return undefined;
    const isUserTeacher = currentUser.role === "teacher" || currentUser.role === "Admin" || currentUser.role === "admin";
    const isCreatedBySelf = d.createdBy === currentUser.id;
    const isCreatedByTeacher = d.creatorRole === "teacher" || d.creatorRole === "Admin" || d.creatorRole === "admin";
    if (isUserTeacher || isCreatedBySelf || isCreatedByTeacher) {
      return d;
    }
    return undefined;
  },
  addDeck: async (deck: Deck) => {
    const creatorId = currentUser?.id || "guest";
    const creatorRole = currentUser?.role || "student";
    const creatorNameVal = currentUser?.name || "Người dùng";
    
    const deckWithCreator = {
      ...deck,
      createdBy: (deck as any).createdBy || creatorId,
      creatorRole: (deck as any).creatorRole || creatorRole,
      creatorName: (deck as any).creatorName || creatorNameVal
    };

    if (!decks.some(d => d.id === deckWithCreator.id)) {
      decks.push(deckWithCreator);
    } else {
      decks = decks.map(d => d.id === deckWithCreator.id ? deckWithCreator : d);
    }
    saveLocalUserDecks();
    try {
      const { db } = await import("./firebase");
      const { doc, setDoc } = await import("firebase/firestore");
      await setDoc(doc(db, "sets", deck.id), {
        id: deck.id,
        title: deck.title,
        subject: deck.subject,
        cards: deck.cards,
        createdBy: deckWithCreator.createdBy,
        creatorRole: deckWithCreator.creatorRole,
        creatorName: deckWithCreator.creatorName
      });
    } catch (e) {
      console.warn("Failed to add deck/set to Firestore (expected on free plan):", e);
    }
  },
  deleteDeckLocally: (deckId: string) => {
    decks = decks.filter(d => d.id !== deckId);
    if (tempDecks[deckId]) {
      delete tempDecks[deckId];
    }
    saveLocalUserDecks();
  },
  setDecksLocally: (newDecks: Deck[]) => {
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

    newDecks.forEach(newDeck => {
      const existingDeck = decks.find(d => d.id === newDeck.id);
      if (existingDeck && existingDeck.cards && newDeck.cards) {
         newDeck.cards.forEach(newCard => {
             const existingCard = existingDeck.cards.find(c => c.id === newCard.id);
             if (existingCard) {
                 const newTs = getCardTimestamp(newCard);
                 const exTs = getCardTimestamp(existingCard);
                 if (exTs > newTs) {
                     // RAM is newer (e.g. from Firestore fetch), preserve its state
                     newCard.mastery = existingCard.mastery;
                     newCard.isHard = existingCard.isHard;
                     newCard.nextReviewDate = existingCard.nextReviewDate;
                     newCard.nextReview = existingCard.nextReview;
                     newCard.interval = existingCard.interval;
                     newCard.repetitionCount = existingCard.repetitionCount;
                     newCard.easeFactor = existingCard.easeFactor;
                     newCard.updatedAt = existingCard.updatedAt;
                 }
             }
         });
      }
    });

    decks = [...newDecks];
    // Re-inject all active transient decks so getDecks() stays in sync
    Object.values(tempDecks).forEach(tempDeck => {
      if (!decks.some(d => d.id === tempDeck.id)) {
        decks.push(tempDeck);
      }
    });
    saveLocalUserDecks();
  },
  addCardLocally: (deckId: string, card: Flashcard) => {
    const deck = decks.find(d => d.id === deckId);
    if (deck) {
      if (!deck.cards.some(c => c.id === card.id)) {
        deck.cards.push(card);
        saveLocalUserDecks();
      }
    }
  },
  removeCardLocally: (deckId: string, cardId: string) => {
    const deck = decks.find(d => d.id === deckId);
    if (deck) {
      deck.cards = deck.cards.filter(c => c.id !== cardId);
      saveLocalUserDecks();
    }
  },
  buyStreakFreeze: (customPrice?: number) => {
    const price = customPrice !== undefined ? customPrice : 400 * Math.pow(2, currentUser?.streakFreezeCount || 0);
    if (currentUser && currentUser.points >= price && !currentUser.streakFreeze) {
      currentUser.points -= price;
      currentUser.streakFreeze = true;
      currentUser.streakFreezeCount = (currentUser.streakFreezeCount || 0) + 1;
      syncUserToFirebase();
      return true;
    }
    return false;
  },
  buyXPPotion: (price: number = 150, xpEarned: number = 50) => {
    if (currentUser && currentUser.points >= price) {
      currentUser.points = currentUser.points - price + xpEarned;
      syncUserToFirebase();
      return true;
    }
    return false;
  },
  buyLevelUp: (price: number = 600) => {
    if (currentUser && currentUser.points >= price) {
      currentUser.points -= price;
      // Calculate current level and add 1
      const currentLevel = currentUser.level || Math.max(1, Math.floor(Math.sqrt(Math.max(0, currentUser.points) / 50)) + 1);
      currentUser.level = currentLevel + 1;
      syncUserToFirebase();
      return true;
    }
    return false;
  },
  buyDoubleXP: (price: number = 250) => {
    if (currentUser && currentUser.points >= price) {
      currentUser.points -= price;
      currentUser.doubleXPUntil = Date.now() + 15 * 60 * 1000;
      syncUserToFirebase();
      return true;
    }
    return false;
  },
  buyHideRank: (price: number = 200) => {
    if (currentUser && currentUser.points >= price) {
      currentUser.points -= price;
      currentUser.hideRankUntil = Date.now() + 24 * 60 * 60 * 1000;
      syncUserToFirebase();
      return true;
    }
    return false;
  },
  buyArgusEyes: (price: number = 300) => {
    if (currentUser && currentUser.points >= price) {
      currentUser.points -= price;
      currentUser.argusEyesUntil = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      syncUserToFirebase();
      return true;
    }
    return false;
  },
  activateAchillesBuff: () => {
    if (currentUser) {
      currentUser.achillesUntil = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      currentUser.points += 1; // Nhận thêm 1 pt (achilles pt hoặc Tinh Hoa)
      syncUserToFirebase();
      return true;
    }
    return false;
  },
  deductPoints: (amount: number) => {
    if (currentUser && currentUser.points >= amount) {
       currentUser.points -= amount;
       syncUserToFirebase();
       return true;
    }
    return false;
  },
  breakAchillesStreak: () => {
    if (currentUser) {
      // Penalty: Reset streak to 0, subtract points equivalent to a level if possible
      currentUser.streak = 0;
      delete (currentUser as any).lastStreakDate;
      syncUserToFirebase();
    }
  },
  buyAdminRole: (price: number = 99999999999) => {
    if (currentUser && currentUser.points >= price) {
      currentUser.points -= price;
      currentUser.role = "Admin";
      syncUserToFirebase();
      return true;
    }
    return false;
  },
  verifyAdminKeyAndUpdateRole: (adminKey: string) => {
    if (currentUser) {
       const isFirebaseConnected = !!import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_API_KEY !== "DUMMY_KEY_FOR_INIT";
       const correctAdminKey = isFirebaseConnected 
         ? (import.meta.env.VITE_ADMIN_KEY || "disabled_in_client_use_backend")
         : "seneca";
         
       if (adminKey === correctAdminKey) {
          currentUser.role = "Admin";
          syncUserToFirebase();
          return true;
       }
    }
    return false;
  },
  addBonusPoints: (points: number) => {
    if (currentUser) {
        const isDoubleXP = currentUser.doubleXPUntil && currentUser.doubleXPUntil > Date.now();
        const isAchilles = currentUser.achillesUntil && currentUser.achillesUntil > Date.now();
        let multiplier = 1;
        if (isAchilles) multiplier = 4;
        else if (isDoubleXP) multiplier = 2;
        currentUser.points += points * multiplier;
        syncUserToFirebase();
    }
  },
  updateCardMastery: (deckId: string, cardId: string, remembered: boolean) => {
     let deck = decks.find(d => d.id === deckId) || tempDecks[deckId];
     
     // Fallback: search across all available decks in tempDecks if originDeckId was grouped
     if (!deck) {
         deck = Object.values(tempDecks).find((d: any) => d.id === deckId);
     }
     
     // Deep Fallback: search across all decks to find the actual card
     if (!deck) {
         deck = decks.find(d => d.cards.some((c: any) => c.id === cardId));
         if (!deck) {
             deck = Object.values(tempDecks).find((d: any) => d.cards.some((c: any) => c.id === cardId));
         }
     }
     
     if (!deck) return;
     const card = deck.cards.find((c: any) => c.id === cardId);
     if (!card) return;

     const oldMastery = card.mastery;

     // SuperMemo-2 Spaced Repetition Logic
     let quality = remembered ? 4 : 1; 
     let rep = card.repetitionCount || 0;
     let ef = card.easeFactor || 2.5;
     let inter = card.interval || 0;

     if (remembered) {
         if (rep === 0) {
             inter = 1;
         } else if (rep === 1) {
             inter = 6;
         } else {
             inter = Math.round(inter * ef);
         }
         rep += 1;
         
         card.mastery = Math.min(100, card.mastery + 20);
         card.isHard = false;
         if (currentUser) {
             const isDoubleXP = currentUser.doubleXPUntil && currentUser.doubleXPUntil > Date.now();
             const isAchilles = currentUser.achillesUntil && currentUser.achillesUntil > Date.now();
             let multiplier = 1;
             if (isAchilles) multiplier = 4;
             else if (isDoubleXP) multiplier = 2;
             
             // ANTI-SPAM MECHANISM: Ngăn cày điểm bằng cách giới hạn 2 tiếng/mỗi thẻ mới có điểm
             const twoHours = 2 * 60 * 60 * 1000;
             const canEarnPoints = !card.lastPointAwarded || (Date.now() - card.lastPointAwarded >= twoHours);
             
             if (canEarnPoints) {
                 currentUser.points += multiplier;
                 card.lastPointAwarded = Date.now();
                 import('../vibe-sandbox/sync/VibeSyncEngine').then(({ VibeSyncEngine }) => {
                    VibeSyncEngine.saveProfile(currentUser!.id, { points: currentUser!.points });
                 }).catch(e => console.error("OfflineSync Points enqueue error:", e));
                 import('../utils/offlineDb').then(({ saveProfileMetaOffline }) => {
                    saveProfileMetaOffline(currentUser!.id, currentUser!).catch(e => console.error("Offline profile cache backup error:", e));
                 }).catch(e => console.warn(e));
             }
         }
     } else {
         rep = 0;
         inter = 1;
         card.mastery = Math.max(0, card.mastery - 20);
         card.isHard = true;
         if (currentUser && currentUser.achillesUntil && currentUser.achillesUntil > Date.now()) {
             if (currentUser.streak && currentUser.streak > 1) {
                 currentUser.streak = 1;
                 import('../vibe-sandbox/sync/VibeSyncEngine').then(({ VibeSyncEngine }) => {
                    VibeSyncEngine.saveProfile(currentUser!.id, { streak: 1 });
                 });
             } else if (currentUser.level && currentUser.level > 1) {
                 currentUser.level -= 1;
                 import('../vibe-sandbox/sync/VibeSyncEngine').then(({ VibeSyncEngine }) => {
                    VibeSyncEngine.saveProfile(currentUser!.id, { level: currentUser!.level });
                 });
             }
             import('../utils/offlineDb').then(({ saveProfileMetaOffline }) => {
                saveProfileMetaOffline(currentUser!.id, currentUser!).catch(e => console.error("Offline profile cache backup error:", e));
             }).catch(e => console.warn(e));
         }
     }

     ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
     if (ef < 1.3) ef = 1.3;

     const nowStr = new Date().toISOString();
     card.repetitionCount = rep;
     card.easeFactor = ef;
     card.interval = inter;
     card.isNewCard = false;
     card.updatedAt = nowStr;
     card.nextReviewDate = Date.now() + (inter * 86400000); // interval to milliseconds

     const masteryChange = card.mastery - oldMastery;
     
     // Save offline local cache for the updated deck mastery status
     saveLocalUserDecks();

     if (currentUser && currentUser.id) {
         // Sync to Firestore Architecture 3. users/{uid}/cardsState/{cardId}
         const payload = {
             mastery: card.mastery,
             nextReviewDate: card.nextReviewDate, // updated
             nextReview: card.nextReviewDate, // legacy support fallback
             interval: card.interval,
             repetitionCount: card.repetitionCount,
             easeFactor: card.easeFactor,
             isNewCard: card.isNewCard,
             isWeakCard: card.isHard,
             lastPointAwarded: card.lastPointAwarded,
             updatedAt: nowStr
         };

         import('../vibe-sandbox/sync/VibeSyncEngine').then(({ VibeSyncEngine }) => {
            VibeSyncEngine.updateCardState(currentUser!.id, card.id, payload).catch(err => console.warn("Queue ignored:", err));
         }).catch(e => console.error("VibeSync CardState enqueue error:", e));
         
         if (currentUser) {
             const today = new Date().toISOString().split('T')[0];
             const key = `daily_reviewed_${currentUser.id}_${today}`;
             const currentReviewed = parseInt(localStorage.getItem(key) || "0", 10);
             localStorage.setItem(key, (currentReviewed + 1).toString());

             reviewHistory.push({
               id: uuidv4(),
               userId: currentUser.id,
               cardId: card.id,
               deckTitle: deck.title,
               front: card.front,
               remembered,
               masteryChange,
               timestamp: Date.now()
             });
             saveReviewHistoryToLocal();
         }
     }
  },
  getReviewHistory: (userId: string) => {
     return reviewHistory.filter(r => r.userId === userId).sort((a, b) => b.timestamp - a.timestamp);
  },
  getGroups: () => groups,
  updateCard: (deckId: string, cardId: string, front: string, back: string, example_sentence?: string) => {
     // 1. Update persistent decks
     const deck = decks.find(d => d.id === deckId);
     if (deck) {
       const card = deck.cards.find(c => c.id === cardId);
       if (card) {
         card.front = front;
         if (example_sentence !== undefined) card.example_sentence = example_sentence;
         card.back = back;
         saveLocalUserDecks();
       }
     }
     // 2. Update tempDecks
     const tempDeck = tempDecks[deckId];
     if (tempDeck && tempDeck.cards) {
       const tempCard = tempDeck.cards.find((c: any) => c.id === cardId);
       if (tempCard) {
         tempCard.front = front;
         if (example_sentence !== undefined) tempCard.example_sentence = example_sentence;
         tempCard.back = back;
       }
     }
  },
  removeDeckLocally: (deckId: string) => {
     decks = decks.filter(d => d.id !== deckId);
     saveLocalUserDecks();
  },
  createGroup: (name: string) => {
    let g = { id: `grp_${uuidv4().substring(0, 8)}`, name, members: currentUser ? [currentUser.id] : [] };
    groups.push(g);
    return g;
  },
  joinGroup: (id: string) => {
    let g = groups.find(x => x.id === id);
    if (g && currentUser && !g.members.includes(currentUser.id)) {
      g.members.push(currentUser.id);
    }
    return g;
  },
  getISOWeekId: () => getISOWeekId()
};
