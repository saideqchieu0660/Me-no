import { toast } from "sonner";
import React, { useState, useEffect, lazy, Suspense } from "react";
import {
  Link,
  Routes,
  Route,
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  Moon,
  Sun,
  LogOut,
  MessageCircle,
  Flame,
  Volume2,
  VolumeX,
  Home,
  BookOpen,
  Shield,
  User as UserIcon,
  Settings,
  X,
  ChevronRight,
  Cpu,
  RefreshCw,
  Check,
  Maximize,
  Minimize,
  Sparkles,
  Key,
  Menu,
} from "lucide-react";
import { motion, AnimatePresence, MotionConfig } from "motion/react";
import { useTheme, ThemeProvider } from "./components/ThemeProvider";
import { SoundProvider, useSoundContext } from "./components/SoundProvider";
import { Breadcrumbs } from "./components/Breadcrumbs";
import { syncAIPrompts } from "./utils/apiClient";
import { isFeatureEnabled } from "./features.config";
import { MaintenanceStub } from "./components/MaintenanceStub";
import { VibeSidebar } from "./vibe-sandbox/VibeSidebar";

const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const AuthScreen = lazy(() => import("./components/AuthScreen"));
const TeacherDashboard = lazy(() => import("./pages/TeacherDashboard"));
const StudyRoom = lazy(() => import("./pages/StudyRoom"));
const SetupProfileScreen = lazy(() => import("./pages/SetupProfileScreen"));
const NextGenMonitorGrid = lazy(() => import("./components/dashboard/NextGenMonitorGrid").then(module => ({ default: module.NextGenMonitorGrid })));
const VibeApiHealthMonitor = lazy(() => import("./vibe-sandbox/VibeApiHealthMonitor"));
const AdminCreateCards = lazy(() => import("./pages/AdminCreateCards"));
const VerifyEmailScreen = lazy(() => import("./components/VerifyEmailScreen"));
const CategoryView = lazy(() => import("./pages/CategoryView"));
const SandboxRouter = lazy(() => import("./sandbox/SandboxRouter"));

import { GlobalErrorToast } from "./components/GlobalErrorToast";
import { BYOKRequiredModal } from "./components/BYOKRequiredModal";
import { AudioVisualizer } from "./components/AudioVisualizer";
import {
  getLevelInfo,
  getUnlockedBorders,
  getCustomTitleTextClass,
} from "./utils/xp";
import { GlobalErrorReporter } from "./components/GlobalErrorReporter";
import { auth, FirebaseListenerManager } from "./lib/firebase";
import {
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
} from "firebase/auth";
import { store } from "./lib/store";

import { Toaster } from "sonner";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { DashboardSkeleton } from "./components/DashboardSkeleton";
import { AppUpdateNotification } from "./components/AppUpdateNotification";
import { ForceRefreshButton } from "./components/ForceRefreshButton";
import { ShortcutsHelpModal } from "./components/ShortcutsHelpModal";
import { ConfirmModal } from "./components/ConfirmModal";
import Agent3Widget from "./components/Agent3Widget";
import { Keyboard, Timer, CloudUpload } from "lucide-react";
import { DeepWorkTimer } from "./components/DeepWorkTimer";
import { usePomodoro } from "./lib/PomodoroStore";
import { VibeProgressSyncManager } from "./vibe-sandbox/sync/VibeProgressSyncManager";

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}



const PageLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-zinc-500">
    <div className="w-8 h-8 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
  </div>
);

const PageWrapper = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 30, scale: 0.98 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: -20, scale: 0.95 }}
    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    className="w-full min-h-screen min-h-screen-safe relative"
  >
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>{children}</Suspense>
    </ErrorBoundary>
  </motion.div>
);

function Layout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme, isFixLagEnabled, toggleFixLag } = useTheme();
  const { isSoundEnabled, toggleSound } = useSoundContext();
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const [user, setUser] = useState<any>(null);
  const [currentUserRank, setCurrentUserRank] = useState<number | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [pulse, setPulse] = useState(false);
  const currentUserObj = store.getCurrentUser();
  const isUserAdminOrTeacher =
    currentUserObj?.role === "teacher" ||
    currentUserObj?.role === "admin" ||
    currentUserObj?.role === "Admin";
  const [isAdminMode, setIsAdminMode] = useState(
    sessionStorage.getItem("isAdminMode") !== "false",
  );
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [adminKeyInput, setAdminKeyInput] = useState("");
  const [cerebrasKeyInput, setCerebrasKeyInput] = useState(localStorage.getItem("henosis_cerebras_key") || "");
  const hasCerebrasKey = !!localStorage.getItem("henosis_cerebras_key");

  const handleSaveCerebrasKey = async () => {
    if (cerebrasKeyInput.trim()) {
      const keyStr = cerebrasKeyInput.trim();
      localStorage.setItem("henosis_cerebras_key", keyStr);
      toast("Đã lưu Google API Key trên máy thành công!");
      setCerebrasKeyInput(keyStr);
      
      const currentUserObj = store.getCurrentUser();
      if (currentUserObj) {
        try {
          const auth = (await import("./lib/firebase")).auth;
          const token = await auth.currentUser?.getIdToken();
          if (token) {
            const res = await fetch("/api/user/keys/cerebras/save", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
              },
              body: JSON.stringify({ key: keyStr })
            });
            if (res.ok) {
              toast.success("Đã đồng bộ Key lên Đám Mây an toàn ☁️");
            }
          }
        } catch (e) {
          console.warn("Failed to sync BYOK key to cloud", e);
        }
      }
    }
  };

  const handleDeleteCerebrasKey = () => {
    localStorage.removeItem("henosis_cerebras_key");
    setCerebrasKeyInput("");
    toast("Đã xóa Google API Key!");
  };

  // Auto-fetch BYOK key from cloud if not present locally
  useEffect(() => {
    if (!user) return;
    const fetchCloudKey = async () => {
      try {
        const localKey = localStorage.getItem("henosis_cerebras_key");
        if (localKey) return; // Prioritize local if it exists

        const auth = (await import("./lib/firebase")).auth;
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;

        const res = await fetch("/api/user/keys/cerebras", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        const data = await res.json();
        if (data.success && data.hasKey && data.key) {
          localStorage.setItem("henosis_cerebras_key", data.key);
          setCerebrasKeyInput(data.key);
          toast.success("Đã khôi phục API Key từ Đám Mây ☁️");
        }
      } catch (e) {
        console.warn("Failed to fetch cloud BYOK key", e);
      }
    };
    fetchCloudKey();
  }, [user]);
  const [isVerifyingAdmin, setIsVerifyingAdmin] = useState(false);
  const [adminVerifyResult, setAdminVerifyResult] = useState<{
    success?: boolean;
    message?: string;
  } | null>(null);

  const [showSyncConfirm, setShowSyncConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const { 
    isEnabled: isDeepWorkMode, 
    setIsEnabled: setIsDeepWorkMode,
    workTime,
    setWorkTimeMinutes
  } = usePomodoro();

  const toggleDeepWork = () => {
    setIsDeepWorkMode(!isDeepWorkMode);
  };

  const handleVerifyAdminKey = async () => {
    if (!adminKeyInput.trim() || !user) return;
    setIsVerifyingAdmin(true);
    setAdminVerifyResult(null);
    try {
      // Vibe Sandbox: Thử cập nhật quyền admin local trước (có fallback logic kiểm tra seneca)
      const localSuccess = store.verifyAdminKeyAndUpdateRole(adminKeyInput);
      if (localSuccess) {
        setAdminVerifyResult({
          success: true,
          message:
            "Mã hợp lệ! Đã nâng cấp phân quyền thành công! Vui lòng làm lại trang.",
        });
        sessionStorage.setItem("adminToken", "true");
        localStorage.setItem("henosis_admin_key", adminKeyInput);
        
        // Update local state directly so it re-renders immediately if needed
        store.updateCurrentUser({ role: "Admin", isPro: true });
        
        setTimeout(() => window.location.reload(), 1500);
        return;
      }

      const verifyRes = await fetch("/api/auth/escalate-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, providedKey: adminKeyInput }),
      }).then((res) => res.json());

      if (verifyRes.success) {
        setAdminVerifyResult({
          success: true,
          message:
            "Mã hợp lệ! Đã nâng cấp phân quyền thành công! Vui lòng làm lại trang.",
        });
        if (
          verifyRes.role === "Admin" ||
          verifyRes.role === "admin" ||
          verifyRes.role === "teacher"
        ) {
          sessionStorage.setItem("adminToken", "true");
          localStorage.setItem("henosis_admin_key", adminKeyInput);
        }
        // Cập nhật local store
        store.updateCurrentUser({
          role: verifyRes.role || "student",
          isPro: verifyRes.isPro ?? true,
        });
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setAdminVerifyResult({
          success: false,
          message: "Mã phân quyền không đúng.",
        });
      }
    } catch (e: any) {
      setAdminVerifyResult({
        success: false,
        message: e.message || "Đã xảy ra lỗi",
      });
    } finally {
      setIsVerifyingAdmin(false);
    }
  };
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    syncAIPrompts();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Guard against triggering while typing in input elements
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          (activeEl as HTMLElement).isContentEditable ||
          activeEl.getAttribute("role") === "textbox")
      ) {
        return;
      }

      // Ignore modifier keys to avoid overriding browser standard bindings (Ctrl+S, Command+R etc.)
      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      const key = e.key;
      if (!key) return;
      const keyUpper = key.toUpperCase();

      const triggerNav = (tabName: string) => {
        // Switch view if we are on a different page
        if (location.pathname !== "/dashboard") {
          navigate("/dashboard");
          // Wait slightly for mounting before dispatching tab change
          setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent("henosis-keyboard-nav", {
                detail: { tab: tabName },
              }),
            );
          }, 300);
        } else {
          window.dispatchEvent(
            new CustomEvent("henosis-keyboard-nav", {
              detail: { tab: tabName },
            }),
          );
        }
      };

      // Map shortcuts
      switch (keyUpper) {
        case "H":
          e.preventDefault();
          triggerNav("study");
          break;
        case "U":
          e.preventDefault();
          triggerNav("create_deck");
          break;
        case "R":
          e.preventDefault();
          triggerNav("ranking");
          break;
        case "P":
          e.preventDefault();
          triggerNav("profile");
          break;
        case "O":
          e.preventDefault();
          navigate("/co-study");
          break;
        case "S":
          e.preventDefault();
          setShowSettingsModal((prev) => !prev);
          break;
        case "E":
          e.preventDefault();
          toggleFixLag();
          break;
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "?":
        case "/": // handle Shift+/ which yields '?'
          if (key === "?") {
            e.preventDefault();
            setShowShortcutsModal((prev) => !prev);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [location.pathname, toggleFixLag, navigate]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Lỗi bật toàn màn hình: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    // Escalate full app re-renders when local user state/cosmetics change
    const forceGlobalRender = () => {
      const freshUser = store.getCurrentUser();
      if (freshUser) {
        setUser((prev: any) => {
          if (!prev) return freshUser;
          // Deep or shallow comparison to avoid unnecessary re-renders
          const hasChanges = Object.keys(freshUser).some(key => prev[key] !== (freshUser as any)[key]);
          if (!hasChanges) return prev;
          return { ...prev, ...freshUser };
        });
      }
    };
    window.addEventListener("user-cosmetics-updated", forceGlobalRender);
    window.addEventListener("henosis-data-synced", forceGlobalRender);
    return () => {
      window.removeEventListener("user-cosmetics-updated", forceGlobalRender);
      window.removeEventListener("henosis-data-synced", forceGlobalRender);
    };
  }, []);

  const [notifReminder, setNotifReminder] = useState(() => {
    return localStorage.getItem("henosis_notifications") === "true";
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleNotifReminder = async () => {
    if (notifReminder) {
      setNotifReminder(false);
      localStorage.setItem("henosis_notifications", "false");
      window.dispatchEvent(
        new CustomEvent("henosis_notifications_changed", {
          detail: { enabled: false },
        }),
      );
    } else {
      if (!("Notification" in window)) {
        toast(
          "Trình duyệt của ngài không hỗ trợ Browser Notifications API rồi!",
        );
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setNotifReminder(true);
        localStorage.setItem("henosis_notifications", "true");
        window.dispatchEvent(
          new CustomEvent("henosis_notifications_changed", {
            detail: { enabled: true },
          }),
        );
        try {
          new Notification("Henosis Web 🔔", {
            body: "Đã kích hoạt nhắc nhở học tập hàng ngày thành công! Hãy nỗ lực giữ streak nhé! 💪🔥",
          });
        } catch (e) {
          console.error(e);
        }
      } else {
        toast(
          "Ngài cần cấp quyền thông báo đẩy trên trình duyệt thì hệ thống mới nhắc học bài được nha!",
        );
      }
    }
  };

  useEffect(() => {
    const handleNotifEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (
        customEvent.detail &&
        typeof customEvent.detail.enabled === "boolean"
      ) {
        setNotifReminder(customEvent.detail.enabled);
      } else {
        const saved = localStorage.getItem("henosis_notifications") === "true";
        setNotifReminder(saved);
      }
    };
    window.addEventListener("henosis_notifications_changed", handleNotifEvent);
    return () => {
      window.removeEventListener(
        "henosis_notifications_changed",
        handleNotifEvent,
      );
    };
  }, []);

  useEffect(() => {
    if (!notifReminder) return;

    const checkAndNotify = () => {
      const lastStudyDate = localStorage.getItem("last_study_date");
      const today = new Date().toDateString();
      if (lastStudyDate !== today) {
        try {
          new Notification("Henosis Web ⏰ Nhắc Nhở Học Tập", {
            body: "Ngài ơi, hôm nay ngài chưa ôn luyện flashcard nào. Hãy thắp lại ngọn lửa tri thức ngay!! 📚🔥",
          });
        } catch (e) {
          console.error(e);
        }
      }
    };

    const initialTimer = setTimeout(() => {
      const lastNotifiedToday =
        localStorage.getItem("last_notified_today") ===
        new Date().toDateString();
      if (!lastNotifiedToday) {
        checkAndNotify();
        localStorage.setItem("last_notified_today", new Date().toDateString());
      }
    }, 5000);

    const interval = setInterval(checkAndNotify, 4 * 60 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [notifReminder]);

  const handleForceSync = async () => {
    if (!user) return;
    setIsSyncing(true);
    setSyncSuccess(false);
    try {
      // Gọi setFirebaseUser để kéo trực tiếp profiles, sets, và card states mới nhất từ Firestore
      await store.setFirebaseUser(auth.currentUser);

      // Force a local React state update so App.tsx layout re-renders natively
      setUser(auth.currentUser ? (auth.currentUser as any) : null);

      // Dispatch sự kiện đẻ re-render / đồng bộ ở các màn hình khác
      window.dispatchEvent(new CustomEvent("henosis-data-synced"));

      setSyncSuccess(true);
      setTimeout(() => setSyncSuccess(false), 2500);
    } catch (err) {
      console.error("Force Sync err:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Tinh chỉnh cỡ chữ động lưu trong localStorage
  const [appFontSize, setAppFontSize] = useState<number>(() => {
    const saved = localStorage.getItem("henosis-font-size");
    return saved ? parseInt(saved, 10) : 16;
  });

  const [appUiDensity, setAppUiDensity] = useState<"comfortable" | "compact">(
    () => {
      const saved = localStorage.getItem("henosis-ui-density");
      return saved === "compact" || saved === "comfortable"
        ? saved
        : "comfortable";
    },
  );

  useEffect(() => {
    // Phóng to tỉ lệ cho toàn hệ thống bằng cách thay đổi cỡ chữ của root Element (html)
    // Giúp các thành phần sử dụng rem (paddings, margins, widths, heights) tự giãn rộng đồng tỉ lệ.
    document.documentElement.style.fontSize = `${appFontSize}px`;
    document.documentElement.style.setProperty(
      "--app-font-scale",
      (appFontSize / 16).toString(),
    );
  }, [appFontSize]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      "--ui-density",
      appUiDensity === "compact" ? "0.8" : "1.0",
    );
  }, [appUiDensity]);

  useEffect(() => {
    const handleCustomChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.size === "number") {
        setAppFontSize(customEvent.detail.size);
      }
    };
    const handleDensityChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (
        customEvent.detail &&
        (customEvent.detail.density === "comfortable" ||
          customEvent.detail.density === "compact")
      ) {
        setAppUiDensity(customEvent.detail.density);
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

  const toggleAdminMode = () => {
    const newMode = !isAdminMode;
    setIsAdminMode(newMode);
    sessionStorage.setItem("isAdminMode", newMode ? "true" : "false");
    navigate(newMode ? "/teacher" : "/dashboard");
  };

  // Trình giám sát độ tương phản thông minh (A11y Contrast Monitor)
  const [contrastStatus, setContrastStatus] = useState<{
    totalChecked: number;
    failingCount: number;
    failingElements: Array<{
      text: string;
      textColour: string;
      bgColour: string;
      ratio: number;
      required: number;
      tag: string;
    }>;
  }>({
    totalChecked: 0,
    failingCount: 0,
    failingElements: [],
  });

  const runContrastCheck = () => {
    try {
      const elements = Array.from(
        document.querySelectorAll(
          "p, span, button, a, h1, h2, h3, h4, h5, h6, label, .card-3d, .glass",
        ),
      ) as HTMLElement[];

      let totalChecked = 0;
      let failingCount = 0;
      const failingElementsList: Array<{
        text: string;
        textColour: string;
        bgColour: string;
        ratio: number;
        required: number;
        tag: string;
      }> = [];

      const getRelativeLuminance = (rgbString: string): number => {
        const match = rgbString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!match) return 0;
        const r = parseInt(match[1], 10) / 255;
        const g = parseInt(match[2], 10) / 255;
        const b = parseInt(match[3], 10) / 255;

        const adjust = (val: number) => {
          return val <= 0.03928
            ? val / 12.92
            : Math.pow((val + 0.055) / 1.055, 2.4);
        };

        return 0.2126 * adjust(r) + 0.7152 * adjust(g) + 0.0722 * adjust(b);
      };

      const getElementBgColor = (element: HTMLElement): string => {
        let el: HTMLElement | null = element;
        while (el) {
          const style = window.getComputedStyle(el);
          const bg = style.backgroundColor;
          if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
            const alphaMatch = bg.match(
              /rgba?\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/,
            );
            if (alphaMatch && parseFloat(alphaMatch[1]) < 0.1) {
              el = el.parentElement;
              continue;
            }
            return bg;
          }
          el = el.parentElement;
        }
        return "rgb(255, 255, 255)"; // Trả về màu trắng mặc định nếu không tìm thấy
      };

      elements.forEach((el) => {
        const text = (el.innerText || el.textContent || "").trim();
        if (!text || text.length < 2 || text.length > 80) return;
        if (el.offsetWidth === 0 && el.offsetHeight === 0) return;

        const style = window.getComputedStyle(el);
        const textColour = style.color;
        if (!textColour) return;

        const bgColour = getElementBgColor(el);

        const l1 = getRelativeLuminance(textColour);
        const l2 = getRelativeLuminance(bgColour);
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        const ratio = (lighter + 0.05) / (darker + 0.05);

        const fontSize = parseFloat(style.fontSize) || 16;
        const fontWeight = style.fontWeight;
        const isBold =
          fontWeight === "bold" ||
          fontWeight === "700" ||
          fontWeight === "800" ||
          fontWeight === "900";
        const isLargeText = fontSize >= 24 || (fontSize >= 18 && isBold);
        const required = isLargeText ? 3.0 : 4.5;

        totalChecked++;

        if (ratio < required) {
          failingCount++;
          if (failingElementsList.length < 5) {
            failingElementsList.push({
              text: text.slice(0, 25) + (text.length > 25 ? "..." : ""),
              textColour,
              bgColour,
              ratio: Math.round(ratio * 100) / 100,
              required,
              tag: el.tagName.toLowerCase(),
            });
          }
        }
      });

      setContrastStatus({
        totalChecked,
        failingCount,
        failingElements: failingElementsList,
      });
    } catch (err) {
      console.error("Lỗi khi quét tương phản:", err);
    }
  };

  const [autofixFeedback, setAutofixFeedback] = useState<string | null>(null);

  const autoFixContrast = () => {
    try {
      const elements = Array.from(
        document.querySelectorAll(
          "p, span, button, a, h1, h2, h3, h4, h5, h6, label, .card-3d, .glass",
        ),
      ) as HTMLElement[];

      let fixedCount = 0;

      const getRelativeLuminanceVal = (
        r: number,
        g: number,
        b: number,
      ): number => {
        const adjust = (val: number) => {
          const v = val / 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * adjust(r) + 0.7152 * adjust(g) + 0.0722 * adjust(b);
      };

      const getContrastRatioVal = (lums1: number, lums2: number): number => {
        const lighter = Math.max(lums1, lums2);
        const darker = Math.min(lums1, lums2);
        return (lighter + 0.05) / (darker + 0.05);
      };

      const parseRgbValues = (
        rgbString: string,
      ): { r: number; g: number; b: number } | null => {
        const match = rgbString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!match) return null;
        return {
          r: parseInt(match[1], 10),
          g: parseInt(match[2], 10),
          b: parseInt(match[3], 10),
        };
      };

      const getElementBgColor = (element: HTMLElement): string => {
        let el: HTMLElement | null = element;
        while (el) {
          const style = window.getComputedStyle(el);
          const bg = style.backgroundColor;
          if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") {
            const alphaMatch = bg.match(
              /rgba?\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)/,
            );
            if (alphaMatch && parseFloat(alphaMatch[1]) < 0.1) {
              el = el.parentElement;
              continue;
            }
            return bg;
          }
          el = el.parentElement;
        }
        return "rgb(255, 255, 255)";
      };

      elements.forEach((el) => {
        const text = (el.innerText || el.textContent || "").trim();
        if (!text || text.length < 2) return;
        if (el.offsetWidth === 0 && el.offsetHeight === 0) return;

        const style = window.getComputedStyle(el);
        const textColourStr = style.color;
        if (!textColourStr) return;

        const bgColourStr = getElementBgColor(el);
        const bgRgb = parseRgbValues(bgColourStr) || { r: 255, g: 255, b: 255 };
        const textRgb = parseRgbValues(textColourStr) || { r: 0, g: 0, b: 0 };

        const bgLum = getRelativeLuminanceVal(bgRgb.r, bgRgb.g, bgRgb.b);
        const textLum = getRelativeLuminanceVal(
          textRgb.r,
          textRgb.g,
          textRgb.b,
        );

        const ratio = getContrastRatioVal(bgLum, textLum);

        const fontSize = parseFloat(style.fontSize) || 16;
        const fontWeight = style.fontWeight;
        const isBold =
          fontWeight === "bold" ||
          fontWeight === "700" ||
          fontWeight === "800" ||
          fontWeight === "900";
        const isLargeText = fontSize >= 24 || (fontSize >= 18 && isBold);
        const required = isLargeText ? 3.0 : 4.5;

        if (ratio < required) {
          let bestColor = "";
          if (bgLum < 0.5) {
            let r = textRgb.r,
              g = textRgb.g,
              b = textRgb.b;
            let currentRatio = ratio;
            let steps = 0;
            while (currentRatio < required && steps < 10) {
              r = Math.min(255, Math.round(r + (255 - r) * 0.4));
              g = Math.min(255, Math.round(g + (255 - g) * 0.4));
              b = Math.min(255, Math.round(b + (255 - b) * 0.4));
              const newLum = getRelativeLuminanceVal(r, g, b);
              currentRatio = getContrastRatioVal(bgLum, newLum);
              steps++;
            }
            if (currentRatio < required) {
              bestColor = "rgb(245, 245, 245)";
            } else {
              bestColor = `rgb(${r}, ${g}, ${b})`;
            }
          } else {
            let r = textRgb.r,
              g = textRgb.g,
              b = textRgb.b;
            let currentRatio = ratio;
            let steps = 0;
            while (currentRatio < required && steps < 10) {
              r = Math.max(0, Math.round(r * 0.6));
              g = Math.max(0, Math.round(g * 0.6));
              b = Math.max(0, Math.round(b * 0.6));
              const newLum = getRelativeLuminanceVal(r, g, b);
              currentRatio = getContrastRatioVal(bgLum, newLum);
              steps++;
            }
            if (currentRatio < required) {
              bestColor = "rgb(20, 20, 20)";
            } else {
              bestColor = `rgb(${r}, ${g}, ${b})`;
            }
          }

          if (bestColor) {
            el.style.color = bestColor;
            el.setAttribute("data-contrast-autofixed", "true");
            fixedCount++;
          }
        }
      });

      // Run recheck immediately to update state
      runContrastCheck();

      if (fixedCount > 0) {
        setAutofixFeedback(
          `Đã tự động tối ưu thành công ${fixedCount} thành phần bị mờ.`,
        );
      } else {
        setAutofixFeedback(
          "Khá khen, không tìm thấy thành phần nào bị mờ cần sửa nữa!",
        );
      }
      setTimeout(() => setAutofixFeedback(null), 4000);
    } catch (err) {
      console.error("Lỗi khi tự sửa tương phản:", err);
      setAutofixFeedback(
        "Có lỗi xảy ra khi tự vá độ tương phản, vui lòng thử lại.",
      );
      setTimeout(() => setAutofixFeedback(null), 4000);
    }
  };

  useEffect(() => {
    if (showSettingsModal) {
      runContrastCheck();
      // Optimization: Removed aggressive 1.5s interval that causes layout thrashing
      // and state updates. It runs once when modal opens, and users can manually re-run
      // if needed, or it runs after autofix.
    }
  }, [showSettingsModal, appFontSize, theme, isFixLagEnabled]);

  useEffect(() => {
    const handler = () => {
      setPulse(true);
      setTimeout(() => setPulse(false), 1000);
    };
    window.addEventListener("app-pulse-logo", handler);
    return () => window.removeEventListener("app-pulse-logo", handler);
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};
    try {
      console.log("Setting up auth state observer...");
      unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
        try {
          // Google account users are already trusted and do not require separate email verification.
          const isGoogleProvider =
            currentUser &&
            currentUser.providerData?.some(
              (p) => p.providerId === "google.com",
            );
          if (
            currentUser &&
            !currentUser.isAnonymous &&
            !currentUser.emailVerified &&
            !isGoogleProvider
          ) {
            await signOut(auth);
            store.logout();
            FirebaseListenerManager.clearAll();
            setUser(null);
            setIsAuthLoading(false);
            const emailParams = currentUser.email
              ? `?email=${encodeURIComponent(currentUser.email)}`
              : "";
            navigate(`/verify${emailParams}`);
            return;
          }

          // Directly sync user with store
          const prevUser = user;
          await store.setFirebaseUser(currentUser);
          setUser(currentUser);

          if (!currentUser) {
            FirebaseListenerManager.clearAll();
          }

          // Force notify any components dependent on global store
          window.dispatchEvent(new CustomEvent("henosis-data-synced"));

          if (currentUser && !prevUser) {
            // Dispatch pulse when logging in
            window.dispatchEvent(new CustomEvent("app-pulse-logo"));
          }
        } catch (e) {
          console.error("Firebase auth initialization error:", e);
          setUser(currentUser);
        } finally {
          setIsAuthLoading(false);
          // Auto anonymous login for missing users
          if (
            !currentUser &&
            window.location.pathname !== "/verify" &&
            window.location.pathname !== "/auth"
          ) {
            import("firebase/auth")
              .then(
                ({
                  signInAnonymously,
                  setPersistence,
                  indexedDBLocalPersistence,
                }) => {
                  setPersistence(auth, indexedDBLocalPersistence)
                    .then(() => {
                      signInAnonymously(auth).catch((e) => {
                        if (
                          e?.code === "auth/api-key-not-valid" || e?.code === "auth/network-request-failed" ||
                          e?.message?.includes("auth/api-key-not-valid") ||
                          e?.message?.includes("DUMMY_KEY_FOR_INIT")
                        ) {
                          console.warn(
                            "Firebase not configured: using local anonymous user.",
                          );
                        } else {
                          console.error("Anonymous login error", e);
                        }
                        // Fallback to local anonymous user if Firebase fails (missing API key)
                        const mockUser = {
                          uid:
                            "local_anon_" +
                            Math.random().toString(36).substr(2, 9),
                          isAnonymous: true,
                          email: "anonymous@local",
                        };
                        store.setFirebaseUser(mockUser).then(() => {
                          setUser(mockUser as any);
                        });
                      });
                    })
                    .catch((e) => {
                      console.error("Persistence error", e);
                      const mockUser = {
                        uid:
                          "local_anon_" +
                          Math.random().toString(36).substr(2, 9),
                        isAnonymous: true,
                        email: "anonymous@local",
                      };
                      store.setFirebaseUser(mockUser).then(() => {
                        setUser(mockUser as any);
                      });
                    });
                },
              )
              .catch((e) => {
                console.error("Firebase auth import error", e);
                const mockUser = {
                  uid: "local_anon_" + Math.random().toString(36).substr(2, 9),
                  isAnonymous: true,
                  email: "anonymous@local",
                };
                store.setFirebaseUser(mockUser).then(() => {
                  setUser(mockUser as any);
                });
              });
          } else if (
            currentUser &&
            (window.location.pathname === "/" ||
              (window.location.pathname === "/auth" &&
                !currentUser.isAnonymous))
          ) {
            if (!currentUser.isAnonymous) {
              const currentStoreUser = store.getCurrentUser();
              if (currentStoreUser) {
                const isTeacher =
                  currentStoreUser.role === "teacher" ||
                  currentStoreUser.role === "admin" ||
                  currentStoreUser.role === "Admin";
                const isExplicitlyStudentMode =
                  sessionStorage.getItem("isAdminMode") === "false";
                navigate(
                  isTeacher && !isExplicitlyStudentMode
                    ? "/teacher"
                    : "/dashboard",
                );
              } else {
                navigate("/dashboard");
              }
            } else {
              const guestPath =
                sessionStorage.getItem("guest_redirect_path") || "/dashboard";
              sessionStorage.removeItem("guest_redirect_path");
              navigate(guestPath);
            }
          }
        }
      });
    } catch (e) {
      console.error("Auth state observer error:", e);
      setIsAuthLoading(false);
    }

    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    let unsub = () => {};
    const setupListener = async () => {
      const { db } = await import("./lib/firebase");
      const { doc, onSnapshot } = await import("firebase/firestore");
      unsub = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
        if (docSnap.exists()) {
          const profileData = docSnap.data();
          const role = profileData.role || "student";
          store.updateCurrentUser(
            {
              role: role as any,
              name: profileData.name || store.getCurrentUser()?.name || "",
              isPro:
                typeof profileData.isPro === "boolean"
                  ? profileData.isPro
                  : store.getCurrentUser()?.isPro,
              isSchoolLover:
                typeof profileData.isSchoolLover === "boolean"
                  ? profileData.isSchoolLover
                  : store.getCurrentUser()?.isSchoolLover,
              points:
                typeof profileData.points === "number"
                  ? profileData.points
                  : store.getCurrentUser()?.points,
              streak:
                typeof profileData.streak === "number"
                  ? profileData.streak
                  : store.getCurrentUser()?.streak,
              avatarBorder:
                profileData.avatarBorder ||
                store.getCurrentUser()?.avatarBorder,
              title: profileData.title || store.getCurrentUser()?.title,
              averageMastery:
                typeof profileData.averageMastery === "number"
                  ? profileData.averageMastery
                  : store.getCurrentUser()?.averageMastery,
              photoURL:
                profileData.photoURL ||
                store.getCurrentUser()?.photoURL ||
                user.photoURL ||
                "",
            },
            true,
          );
          setUser((prev) => (prev ? { ...prev, role } : null));
        }
      }, (err) => {
         console.warn("User profile snapshot error:", err);
      });
    };
    setupListener();
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    if (!user) {
      setCurrentUserRank(null);
      return;
    }
    let unsub = () => {};
    const setupRankingListener = async () => {
      try {
        const { db } = await import("./lib/firebase");
        const { collection, getDocs, query, where, limit } = await import("firebase/firestore");
        const usersCol = collection(db, "users");
        
        // SỬA LỖI FULL TABLE SCAN GÂY CẠN QUOTA READS
        // Thay vì tải toàn bộ collection users, chỉ tải top 100 người dùng có điểm > 0
        const q = query(usersCol, where("points", ">", 0), limit(100));
        const snapshot = await getDocs(q);
        const usersList: any[] = [];
        snapshot.forEach((doc) => {
          usersList.push({ id: doc.id, ...doc.data() });
        });
        const sorted = usersList.sort(
          (a, b) => (b.points || 0) - (a.points || 0),
        );
        const index = sorted.findIndex((u: any) => u.id === user.uid);
        if (index !== -1) {
          setCurrentUserRank(index + 1);
        } else {
          setCurrentUserRank(null);
        }
      } catch (e) {
        console.error(
          "Error setting up ranking fetch inside App.tsx:",
          e,
        );
      }
    };
    setupRankingListener();
    return () => {};
  }, [user?.uid]);

  const handleLogout = async (redirectToAuth: boolean = true) => {
    try {
      // Clean up co-study room presence before losing auth context
      if (auth.currentUser?.uid) {
        try {
          const { doc, deleteDoc } = await import("firebase/firestore");
          const { db } = await import("./lib/firebase");
          await deleteDoc(doc(db, "costudy_room", auth.currentUser.uid));
        } catch (roomErr) {
          console.error("Cleanup room error:", roomErr);
        }
      }

      if (auth.currentUser?.isAnonymous) {
        try {
          // In case they accidentally accrued a Firestore profile (maybe scored something), clear it to keep Leaderboard clean
          const { dbService } = await import("./lib/firebase");
          await dbService.deleteUserProfile(auth.currentUser.uid);
          await auth.currentUser.delete();
        } catch (delError) {
          console.error("Soft failing cleanup of anonymous auth:", delError);
        }
      } else {
        await signOut(auth);
      }
      store.logout();
      if (redirectToAuth) {
        navigate("/auth");
      } else {
        navigate("/");
      }
    } catch (e) {
      console.error("Error signing out:", e);
    }
  };

  return (
    <MotionConfig reducedMotion={isFixLagEnabled ? "always" : "user"}>
      <div className="min-h-screen flex flex-col font-sans transition-colors duration-300">
        <header className="glass fixed top-0 inset-x-0 z-40 flex flex-col border-b border-zinc-200 dark:border-zinc-800">
          <div className="px-4 md:px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSidebarOpen((prev) => !prev)}
                className="p-2 rounded-xl text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition mr-1 cursor-pointer"
                title="Mở / Đóng Sidebar Navigation"
                aria-label="Toggle Sidebar Navigation"
              >
                <Menu className="w-5 h-5 text-zinc-800 dark:text-white" />
              </button>
              <motion.div
                animate={
                  pulse
                    ? { rotate: [0, 15, -15, 10, -10, 0], scale: [1, 1.2, 1] }
                    : {}
                }
                transition={{ duration: 0.6 }}
                className="text-2xl select-none leading-none"
              >
                🌌🌠
              </motion.div>
              <span className="henosis-title tracking-widest uppercase font-light text-xl md:text-2xl text-zinc-900 dark:text-white">
                HENOSIS
              </span>
            </div>

            <div className="flex items-center gap-1.5 md:gap-4">

              <button
                onClick={toggleFixLag}
                className={`hidden md:flex p-1.5 md:p-2 rounded-full transition flex-shrink-0 items-center justify-center gap-1 text-[11px] font-bold px-2 md:px-2.5 py-1 ${isFixLagEnabled ? "bg-green-500/20 text-green-500 border border-green-500/30" : "hover:bg-black/5 dark:hover:bg-white/10 text-zinc-600 dark:text-zinc-400"}`}
                title={
                  isFixLagEnabled
                    ? "Tiết kiệm pin đang Bật"
                    : "Bật Tiết kiệm pin / Fix Lag"
                }
                aria-label="Toggle Eco Mode"
              >
                <Cpu
                  className={`w-4 h-4 ${isFixLagEnabled ? "animate-pulse" : ""}`}
                />
                <span className="hidden sm:inline">
                  {isFixLagEnabled ? "Eco: On" : "Eco: Off"}
                </span>
              </button>

              <button
                onClick={toggleTheme}
                className=" "
                aria-label="Toggle Theme"
              >
                {theme === "dark" ? (
                  <span className="text-lg leading-none select-none" role="img" aria-label="Sun">☀️</span>
                ) : (
                  <span className="text-lg leading-none select-none" role="img" aria-label="Moon">🌙</span>
                )}
              </button>

              <button
                onClick={toggleFullscreen}
                className=" "
                title={isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình"}
                aria-label="Toggle Fullscreen"
              >
                {isFullscreen ? (
                  <Minimize className="w-5 h-5 text-orange-600 dark:text-orange-500" />
                ) : (
                  <Maximize className="w-5 h-5 hover:scale-105 transition-transform" />
                )}
              </button>

              <div className="hidden md:flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={toggleSound}
                  className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition flex items-center justify-center w-9 h-9"
                  title="Toggle Sound"
                  aria-label="Toggle Sound"
                >
                  <motion.div
                    key={isSoundEnabled ? "sound-on" : "sound-off"}
                    initial={{ scale: 0.5, opacity: 0.5 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    {isSoundEnabled ? (
                      <Volume2 className="w-5 h-5 text-orange-600 dark:text-orange-500" />
                    ) : (
                      <VolumeX className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                    )}
                  </motion.div>
                </button>
                {isSoundEnabled && <AudioVisualizer />}
              </div>

              {user && (
                <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                  {isUserAdminOrTeacher && (
                    <button
                      onClick={toggleAdminMode}
                      className="px-3 py-1.5 flex items-center gap-1.5 text-xs md:text-sm font-bold rounded-full border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500 hover:text-black transition"
                      title="Chuyển đổi chế độ"
                    >
                      {isAdminMode ? (
                        <Shield className="w-4 h-4 text-orange-500" />
                      ) : (
                        <UserIcon className="w-4 h-4 text-emerald-500" />
                      )}
                      <span className="text-[10px] md:text-xs font-bold whitespace-nowrap">
                        {isAdminMode ? "Admin View" : "Student View"}
                      </span>
                    </button>
                  )}
                  <div className="flex items-center gap-2.5">
                    {(() => {
                      const safeUser = currentUserObj || user;
                      const equippedBorder = safeUser?.avatarBorder || "none";
                      const ALL_BORDERS = getUnlockedBorders(
                        safeUser?.points || 0,
                        safeUser?.streak || 0,
                        0, // top1Weeks
                        0, // studyTime
                        0, // mastery
                        equippedBorder,
                        safeUser?.unlockedCustomBorders || [],
                      );
                      const borderClass =
                        ALL_BORDERS.find((b) => b.id === equippedBorder)
                          ?.color || "border-2 border-orange-500/30";

                      const xpInfo = getLevelInfo(safeUser?.points || 0);
                      const activeTitle = safeUser?.title || xpInfo.title;

                      return (
                        <>
                          <div className="relative flex-shrink-0">
                            <div
                              className={cn(
                                "w-9 h-9 rounded-full flex items-center justify-center shrink-0 object-cover relative z-10 overflow-hidden",
                                borderClass,
                              )}
                            >
                              {safeUser?.photoURL ? (
                                <img
                                  src={safeUser.photoURL}
                                  alt="Avatar"
                                  className="w-full h-full rounded-full object-cover shadow-sm bg-zinc-100 dark:bg-zinc-800"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-full h-full rounded-full bg-zinc-100 dark:bg-zinc-800/80 flex items-center justify-center text-zinc-600 dark:text-zinc-400 shadow-sm border-2 border-zinc-200 dark:border-zinc-700">
                                  <UserIcon className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                            {/* Floating Yellow Badge above top right corner of avatar with true dynamically updated rank */}
                            {currentUserRank !== null && (
                              <span
                                className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[9px] font-extrabold text-black border border-white dark:border-zinc-900 shadow-md z-10"
                                title={`Hạng ${currentUserRank} Tuần Này`}
                              >
                                {currentUserRank}
                              </span>
                            )}
                          </div>
                          <div className="hidden sm:flex flex-col text-left">
                            <span
                              className={cn(
                                "font-semibold text-xs md:text-sm leading-none",
                                getCustomTitleTextClass(
                                  activeTitle,
                                  "text-zinc-800 dark:text-zinc-200",
                                ),
                              )}
                            >
                              {safeUser?.name ||
                                safeUser?.displayName ||
                                safeUser?.email?.split("@")[0] ||
                                "User"}
                            </span>
                            {safeUser?.role !== "admin" &&
                              safeUser?.role !== "Admin" && (
                                <div className="flex items-center gap-1.5 mt-1">
                                  <span className="text-[9px] font-extrabold text-zinc-500 dark:text-zinc-400">
                                    Lv.{safeUser?.level || xpInfo.currentLevel}
                                  </span>
                                  <div className="w-12 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden shadow-inner">
                                    <div
                                      className="h-full bg-orange-400 rounded-full"
                                      style={{
                                        width: `${xpInfo.progressPercentage}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                              )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  <button
                    onClick={() => setShowSettingsModal(true)}
                    className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition text-zinc-700 dark:text-zinc-300"
                    title="Cài đặt"
                    aria-label="Cài đặt"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>

        </header>

        <div className="flex flex-1 pt-20 min-h-screen min-h-screen-safe">
          <VibeSidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            onToggle={() => setIsSidebarOpen((prev) => !prev)}
            onOpenSettings={() => setShowSettingsModal(true)}
          />
          <main className="flex-1 px-3 sm:px-4 md:px-8 max-w-7xl mx-auto w-full pb-6 pb-safe">
            <Breadcrumbs />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
              {isAuthLoading ? <DashboardSkeleton /> : children}
            </motion.div>
          </main>
        </div>

        <GlobalErrorToast />
        <BYOKRequiredModal />
        <AppUpdateNotification />
        <ForceRefreshButton />
        <ShortcutsHelpModal
          isOpen={showShortcutsModal}
          onClose={() => setShowShortcutsModal(false)}
        />
        <Agent3Widget />

        {/* Emergency font size reset widget inside layout */}
        <AnimatePresence>
          {appFontSize !== 16 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setAppFontSize(16);
                localStorage.setItem("henosis-font-size", "16");
              }}
              className="fixed bottom-6 left-4 md:left-6 z-30 flex items-center gap-2 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-full shadow-lg border border-orange-600/30 cursor-pointer transition-all duration-300 capitalize font-cyber"
              title="Đặt lại cỡ chữ gốc"
              aria-label="Đặt lại cỡ chữ"
            >
              <span className="text-[11px] tracking-wide">
                A↺ Đặt lại cỡ chữ gốc
              </span>
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showSettingsModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1000] flex justify-end bg-black/40 backdrop-blur-sm"
              onClick={() => setShowSettingsModal(false)}
            >
              <motion.div
                initial={{ x: "100%", opacity: 0.5 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "100%", opacity: 0.5 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm h-full bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col"
              >
                <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800">
                  <h3 className="text-xl font-bold flex items-center gap-2">
                    <Settings className="w-5 h-5 text-orange-500" />
                    Cài Đặt
                  </h3>
                  <button
                    onClick={() => setShowSettingsModal(false)}
                    className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                      Cỡ Chữ Hệ Thống
                    </h4>
                    <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">
                          Điều chỉnh phóng to:
                        </span>
                        <span className="font-bold text-sm text-orange-600 dark:text-orange-500">
                          {Math.round((appFontSize / 16) * 100)}% ({appFontSize}
                          px)
                        </span>
                      </div>
                      <input
                        type="range"
                        min="12"
                        max="32"
                        value={appFontSize}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          setAppFontSize(val);
                          localStorage.setItem(
                            "henosis-font-size",
                            val.toString(),
                          );
                        }}
                        className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-orange-505"
                        style={{ accentColor: "#d97706" }}
                      />
                      <div className="flex justify-between text-[10px] text-zinc-400 font-bold">
                        <span>Nhỏ (12px)</span>
                        <span>Trực quan</span>
                        <span>Gấp đôi (32px)</span>
                      </div>
                    </div>
                  </div>

                  {/* Trình giám sát độ tương phản thông minh (A11y Contrast Monitor) */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                      Giám Sát Độ Tương Phản (A11y)
                    </h4>
                    <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition flex flex-col gap-3 bg-zinc-50/50 dark:bg-zinc-800/20">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-xs font-mono text-zinc-500 dark:text-zinc-400">
                          ĐỘ TƯƠNG PHẢN CHỮ:
                        </span>
                        {contrastStatus.failingCount === 0 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20">
                            ĐẠT WCAG AA
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            CẦN TỐI ƯU ({contrastStatus.failingCount})
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        {contrastStatus.failingCount === 0
                          ? "Hệ thống đã quét toàn bộ và tất cả văn bản đều đủ độ tương phản cho hành trình học thuật của ngài!"
                          : "Ngài vừa điều chỉnh cỡ chữ khiến hệ thống phát hiện ra vài thành phần bị nhạt màu, khó đọc. Xem chi tiết bên dưới để biết chỗ mờ nhé!"}
                      </p>

                      <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/60 flex flex-col gap-2">
                        <button
                          onClick={autoFixContrast}
                          className="w-full py-2 px-3 text-xs font-black rounded-xl transition-all duration-200 bg-orange-500 hover:bg-orange-600 text-zinc-950 flex items-center justify-center gap-2 cursor-pointer border border-orange-600 active:scale-95 shadow-sm font-sans"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Tự Động Sửa Tương Phản (Auto-Fix)
                        </button>
                        {autofixFeedback && (
                          <motion.p
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-[10px] text-orange-600 dark:text-orange-400 font-extrabold leading-relaxed text-center"
                          >
                            {autofixFeedback}
                          </motion.p>
                        )}
                      </div>

                      {contrastStatus.failingCount > 0 && (
                        <div className="mt-1 space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                          <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                            Cần cải thiện độ đậm/màu:
                          </span>
                          <div className="max-h-[140px] overflow-y-auto space-y-1.5 pr-1">
                            {contrastStatus.failingElements.map((el, idx) => (
                              <div
                                key={idx}
                                className="flex justify-between items-center text-[10px] p-2 bg-zinc-100/80 dark:bg-zinc-950/40 rounded border border-zinc-200/50 dark:border-zinc-800/60 transition hover:bg-zinc-200/50"
                              >
                                <div className="flex flex-col truncate max-w-[140px]">
                                  <span className="truncate font-medium text-zinc-800 dark:text-zinc-200 font-mono">
                                    "{el.text}"
                                  </span>
                                  <span className="text-[9px] text-zinc-400 lowercase ">
                                    thẻ {el.tag}
                                  </span>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                  <span className="text-rose-600 dark:text-rose-400 font-bold font-mono">
                                    {el.ratio}:1
                                  </span>
                                  <span className="text-zinc-400 text-[9px] block font-mono">
                                    y/c &ge; {el.required}:1
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                      Cấu Hình AI (BYOK)
                    </h4>
                    <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 flex flex-col gap-3">
                      <p className="text-xs text-zinc-600 dark:text-zinc-400">
                        Hệ thống sử dụng siêu AI Google (Gemini). Nhập API Key để sử dụng. Đăng ký nhận key miễn phí tại <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline font-bold">aistudio.google.com</a>.
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-grow">
                          <Key className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="password"
                            placeholder="Google API Key (Bắt đầu bằng AIzaSy...)"
                            value={cerebrasKeyInput}
                            onChange={(e) => setCerebrasKeyInput(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors placeholder:text-zinc-400"
                          />
                        </div>
                        <button
                          onClick={handleSaveCerebrasKey}
                          className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-zinc-50 text-xs font-bold rounded-lg transition-colors shrink-0 cursor-pointer"
                        >
                          Lưu
                        </button>
                        {hasCerebrasKey && (
                          <button
                            onClick={handleDeleteCerebrasKey}
                            className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-bold rounded-lg transition-colors shrink-0 cursor-pointer"
                          >
                            Xóa
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                      Người Dùng
                    </h4>
                    <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 flex flex-col gap-3">
                      <div>
                        <p className="font-bold text-zinc-900 dark:text-white truncate">
                          {user?.email}
                        </p>
                        <p className="text-xs text-zinc-500 mt-1 capitalize">
                          Role: {currentUserObj?.role || "Student"}
                        </p>
                      </div>

                      {!isUserAdminOrTeacher && (
                        <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700 space-y-2">
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
                            Nhập mã phân quyền để nâng cấp (dành cho Giáo
                            viên/Admin):
                          </p>
                          <div className="flex items-center gap-2">
                            <div className="relative flex-grow">
                              <Key className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="password"
                                placeholder="Mã phân quyền"
                                value={adminKeyInput}
                                onChange={(e) =>
                                  setAdminKeyInput(e.target.value)
                                }
                                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-orange-500 transition-colors placeholder:text-zinc-400"
                              />
                            </div>
                            <button
                              onClick={handleVerifyAdminKey}
                              disabled={
                                isVerifyingAdmin || !adminKeyInput.trim()
                              }
                              className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-zinc-950 text-xs font-bold rounded-lg transition-colors shrink-0 disabled:opacity-50 flex items-center justify-center gap-1 min-w-[70px]"
                            >
                              {isVerifyingAdmin ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                "Xác nhận"
                              )}
                            </button>
                          </div>
                          {adminVerifyResult && (
                            <p
                              className={`text-[10px] font-bold ${adminVerifyResult.success ? "text-green-500" : "text-rose-500"}`}
                            >
                              {adminVerifyResult.message}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {isUserAdminOrTeacher && (
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-orange-500 dark:text-orange-400">
                        Quyền Trực Quan & Chế Độ
                      </h4>
                      <div className="p-4 rounded-xl bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/30 flex flex-col gap-3">
                        <p className="text-xs text-zinc-600 dark:text-zinc-300">
                          Bạn đang đăng nhập với quyền{" "}
                          <strong>{currentUserObj?.role}</strong>. Chọn chế độ
                          xem phù hợp:
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (!isAdminMode) {
                                toggleAdminMode();
                              }
                            }}
                            className={`flex-grow py-2 px-3 text-xs font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-1.5 border ${
                              isAdminMode
                                ? "bg-orange-500 text-black border-orange-600 shadow-sm"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                            }`}
                          >
                            <Shield className="w-3.5 h-3.5" />
                            Admin View
                          </button>
                          <button
                            onClick={() => {
                              if (isAdminMode) {
                                toggleAdminMode();
                              }
                            }}
                            className={`flex-grow py-2 px-3 text-xs font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-1.5 border ${
                              !isAdminMode
                                ? "bg-orange-500 text-black border-orange-600 shadow-sm"
                                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                            }`}
                          >
                            <UserIcon className="w-3.5 h-3.5" />
                            Student View
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 flex flex-col gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                      Tùy Chọn Cơ Bản
                    </h4>

                    <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                      <div className="flex items-center gap-3">
                        {theme === "dark" ? (
                          <span className="text-lg leading-none select-none" role="img" aria-label="Moon">🌙</span>
                        ) : (
                          <span className="text-lg leading-none select-none" role="img" aria-label="Sun">☀️</span>
                        )}
                        <span className="font-medium text-sm">
                          Giao Diện (Sáng/Tối)
                        </span>
                      </div>
                      <button
                        onClick={toggleTheme}
                        className="px-3 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-xs font-bold shadow-xs"
                      >
                        Chuyển
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                      <div className="flex items-center gap-3">
                        {isSoundEnabled ? (
                          <Volume2 className="w-5 h-5 text-orange-500" />
                        ) : (
                          <VolumeX className="w-5 h-5 text-zinc-400" />
                        )}
                        <span className="font-medium text-sm">
                          Hiệu Ứng Âm Thanh
                        </span>
                      </div>
                      <button
                        onClick={toggleSound}
                        className="px-3 py-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-700 text-xs font-bold shadow-xs"
                      >
                        {isSoundEnabled ? "Tắt" : "Bật"}
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-805 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition border border-zinc-200 dark:border-zinc-800">
                      <div className="flex items-center gap-3">
                        <Cpu
                          className={`w-5 h-5 ${isFixLagEnabled ? "text-green-500" : "text-zinc-400"}`}
                        />
                        <span className="font-medium text-sm">
                          Tiết Kiệm Pin (Eco / Fix Lag)
                        </span>
                      </div>
                      <button
                        onClick={toggleFixLag}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs ${isFixLagEnabled ? "bg-green-500/20 text-green-500" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"}`}
                      >
                        {isFixLagEnabled ? "Đang Bật" : "Bật"}
                      </button>
                    </div>

                    <div className="flex flex-col p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition gap-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Timer
                            className={`w-5 h-5 ${isDeepWorkMode ? "text-orange-500" : "text-zinc-400"}`}
                          />
                          <span className="font-medium text-sm">
                            Đồng hồ Pomodoro
                          </span>
                        </div>
                        <button
                          onClick={toggleDeepWork}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer ${isDeepWorkMode ? "bg-orange-500/20 text-orange-600 dark:text-orange-400" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"}`}
                        >
                          {isDeepWorkMode ? "Đang Bật" : "Bật"}
                        </button>
                      </div>
                      
                      <AnimatePresence>
                        {isDeepWorkMode && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-zinc-500 font-medium">Thời gian học (phút)</span>
                                <span className="text-xs font-bold text-orange-500">{Math.floor(workTime / 60)}p</span>
                              </div>
                              <input
                                type="range"
                                min="5"
                                max="60"
                                step="5"
                                value={Math.floor(workTime / 60)}
                                onChange={(e) => setWorkTimeMinutes(parseInt(e.target.value))}
                                className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                              />
                              <div className="flex justify-between text-[10px] text-zinc-400 font-bold">
                                <span>5p</span>
                                <span>25p</span>
                                <span>60p</span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* LEGACY FEATURES - HIDDEN BY USER REQUEST */}
                    {false && (
                      <>
                        <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-808 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition border border-zinc-200 dark:border-zinc-800">
                          <div className="flex items-center gap-3">
                            <Keyboard className="w-5 h-5 text-orange-500" />
                            <span className="font-medium text-sm">
                              Phím Tắt & Cẩm Nang
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              setShowSettingsModal(false);
                              setShowShortcutsModal(true);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-orange-500 text-zinc-950 text-xs font-black shadow-xs hover:bg-orange-600 transition cursor-pointer"
                          >
                            Xem
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-4 flex flex-col gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                      Đồng bộ dữ liệu
                    </h4>
                    {/* LEGACY FEATURES - HIDDEN BY USER REQUEST */}
                    {false && (
                      <>
                        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition flex items-center justify-between">
                          <div className="flex items-center gap-3 text-left">
                            <span className="text-xl shrink-0 select-none">🔔</span>
                            <div className="flex flex-col">
                              <span className="font-semibold text-sm">
                                Nhắc Nhở Học Tập
                              </span>
                              <span className="text-[10px] opacity-60 leading-normal">
                                Đẩy thông báo trình duyệt hàng ngày
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={toggleNotifReminder}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-xs transition cursor-pointer shrink-0 ${
                              notifReminder
                                ? "bg-orange-500 hover:bg-orange-600 text-black font-extrabold"
                                : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-650"
                            }`}
                          >
                            {notifReminder ? "Đang Bật" : "Tắt"}
                          </button>
                        </div>
                        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-805 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition flex flex-col gap-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                              <RefreshCw
                                className={`w-5 h-5 ${isSyncing ? "animate-spin text-orange-500" : "text-zinc-400"}`}
                              />
                              <div className="flex flex-col">
                                <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                                  Cưỡng Bức Đồng Bộ
                                </span>
                                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                                  FORCE RESET FIREBASE
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setShowSettingsModal(false);
                                setShowSyncConfirm(true);
                              }}
                              disabled={isSyncing}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 shrink-0 ${
                                syncSuccess
                                  ? "bg-emerald-500 text-white"
                                  : isSyncing
                                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed"
                                    : "bg-orange-500 text-zinc-950 hover:bg-orange-600 cursor-pointer"
                              }`}
                            >
                              {syncSuccess ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  Xong
                                </>
                              ) : isSyncing ? (
                                "Đang nạp..."
                              ) : (
                                "Đồng Bộ"
                              )}
                            </button>
                          </div>
                          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed md:leading-normal">
                            Nếu ngài bị lệch tiến trình học, điểm số, streak, hoặc
                            thẻ X hiển thị 0 so với thiết bị khác, nút này sẽ reload
                            trực tiếp từ Firebase Firestore về để đồng nhất 100%.
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    {!user || user?.isAnonymous ? (
                      <button
                        onClick={async () => {
                          setShowSettingsModal(false);
                          navigate("/auth");
                        }}
                        className="w-full flex items-center justify-between p-4 rounded-xl border border-orange-500/20 bg-orange-500/5 hover:bg-orange-500/10 text-orange-500 transition group cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <UserIcon className="w-5 h-5" />
                          <span className="font-bold text-sm">
                            Đăng ký / Đăng nhập tài khoản
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-transform group-hover:translate-x-1" />
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setShowSettingsModal(false);
                          setShowLogoutConfirm(true);
                        }}
                        className="w-full flex items-center justify-between p-4 rounded-xl border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-500 transition group cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <LogOut className="w-5 h-5" />
                          <span className="font-bold text-sm">
                            Đăng Xuất Mọi Nơi
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-transform group-hover:translate-x-1" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <ConfirmModal
          isOpen={showSyncConfirm}
          onClose={() => setShowSyncConfirm(false)}
          onConfirm={handleForceSync}
          title="Xác nhận đồng bộ"
          message="Thao tác này sẽ ghi đè thiết lập cục bộ và tải lại toàn bộ tiến độ, điểm số, và dữ liệu thẻ từ đám mây (Cloud). Bạn có chắc chắn muốn tiến hành?"
          confirmText="Đồng Bộ"
          isDestructive={false}
        />
        <ConfirmModal
          isOpen={showLogoutConfirm}
          onClose={() => setShowLogoutConfirm(false)}
          onConfirm={() => handleLogout(!user?.isAnonymous)}
          title="Xác nhận đăng xuất"
          message={
            user?.isAnonymous
              ? "Bạn đang ở chế độ khách. Đăng xuất sẽ tạo tài khoản mới và bạn có thể bị mất quyền truy cập vào dữ liệu khách nếu không liên kết. Khuyến nghị sao lưu dữ liệu trước."
              : "Bạn có chắc chắn muốn đăng xuất khỏi thiết bị này? Nếu đăng xuất, các tiến trình chưa học xong có thể bị mất."
          }
          confirmText="Đăng xuất"
          isDestructive={true}
        />
        <DeepWorkTimer />
      </div>
    </MotionConfig>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <ThemeProvider>
      <Toaster position="bottom-right" richColors />
      <GlobalErrorReporter />
      <Layout>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route
              path="/auth"
              element={
                <PageWrapper>
                  <AuthScreen />
                </PageWrapper>
              }
            />
            <Route
              path="/"
              element={
                <PageWrapper>
                  <StudentDashboard />
                </PageWrapper>
              }
            />
            <Route
              path="/dashboard"
              element={
                <PageWrapper>
                  <StudentDashboard />
                </PageWrapper>
              }
            />
            <Route
              path="/verify"
              element={
                <PageWrapper>
                  <VerifyEmailScreen />
                </PageWrapper>
              }
            />
            <Route
              path="/teacher"
              element={
                <PageWrapper>
                  {isFeatureEnabled("ENABLE_TEACHER_DASHBOARD") ? (
                    <TeacherDashboard />
                  ) : (
                    <MaintenanceStub featureName="Teacher Dashboard" />
                  )}
                </PageWrapper>
              }
            />
            <Route
              path="/study/:deckId"
              element={
                <PageWrapper>
                  <StudyRoom />
                </PageWrapper>
              }
            />
            <Route
              path="/setup-profile"
              element={
                <PageWrapper>
                  <SetupProfileScreen />
                </PageWrapper>
              }
            />
            <Route
              path="/admin/monitor"
              element={
                <PageWrapper>
                  <NextGenMonitorGrid />
                </PageWrapper>
              }
            />
            <Route
              path="/vibe-monitor"
              element={
                <PageWrapper>
                  <VibeApiHealthMonitor />
                </PageWrapper>
              }
            />
            <Route
              path="/admin/create-cards"
              element={
                <PageWrapper>
                  {isFeatureEnabled("ENABLE_ADMIN_CREATE") ? (
                    <AdminCreateCards />
                  ) : (
                    <MaintenanceStub featureName="Admin Create Cards" />
                  )}
                </PageWrapper>
              }
            />
            <Route
              path="/category/:categoryName"
              element={
                <PageWrapper>
                  <CategoryView />
                </PageWrapper>
              }
            />
            <Route
              path="/sandbox/*"
              element={
                <PageWrapper>
                  <SandboxRouter />
                </PageWrapper>
              }
            />
            <Route
              path="*"
              element={
                <PageWrapper>
                  <StudentDashboard />
                </PageWrapper>
              }
            />
          </Routes>
        </AnimatePresence>
      </Layout>
    </ThemeProvider>
  );
}
