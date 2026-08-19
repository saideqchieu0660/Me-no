import { usePomodoro } from "../lib/PomodoroStore";
import React, { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { 
  Timer as TimerIcon, Wind, Palette, Check, Trash2, Undo, RotateCcw, Play, Pause, X, Edit3, Type, Maximize2, Minimize2, BarChart2
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { VibePomodoroStats } from "./VibePomodoroStats";

interface VibeStudyCompanionProps {
  currentCardId?: string;
  deckTitle?: string;
  isFlipped?: boolean;
  isTimerOpen: boolean;
  setIsTimerOpen: (open: boolean) => void;
  isScratchpadOpen: boolean;
  setIsScratchpadOpen: (open: boolean) => void;
  isMiniPomodoro: boolean;
  setIsMiniPomodoro: (mini: boolean) => void;
}

interface Stroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

export const VibeStudyCompanion: React.FC<VibeStudyCompanionProps> = ({
  currentCardId,
  deckTitle = "Chung",
  isFlipped = false,
  isTimerOpen,
  setIsTimerOpen,
  isScratchpadOpen,
  setIsScratchpadOpen,
  isMiniPomodoro,
  setIsMiniPomodoro
}) => {
  // Widget Mode: 'pomodoro' | 'breathing' | 'stats'
  const [companionTab, setCompanionTab] = useState<"pomodoro" | "breathing" | "stats">("pomodoro");
  // Scratchpad Drawer Tab: 'sketch' | 'memo'
  const [scratchpadTab, setScratchpadTab] = useState<"sketch" | "memo">("sketch");

  // --- FEATURE 1A: POMODORO TIMER STATE ---
  // Removed local Pomodoro state in favor of global usePomodoro
  
  
  

  // --- FEATURE 1B: 4-7-8 BREATHING STATE ---
  const { isEnabled, setIsEnabled, isActive, mode, timeLeft, toggleTimer, stopTimer, setWorkTimeMinutes, setBreakTimeMinutes } = usePomodoro();
  const [breathPhase, setBreathPhase] = useState<"inhale" | "hold" | "exhale">("inhale");
  const [breathTimeLeft, setBreathTimeLeft] = useState(4);
  const [isBreathingRunning, setIsBreathingRunning] = useState(false);
  const breathingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- FEATURE 3A: SKETCHPAD CANVAS STATE ---
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushColor, setBrushColor] = useState("#f97316"); // Default vibrant orange accent
  const [brushWidth, setBrushWidth] = useState(3);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [isEraser, setIsEraser] = useState(false);

  // --- FEATURE 3B: CARD MEMO STATE ---
  const [cardMemo, setCardMemo] = useState("");
  const [deckMemo, setDeckMemo] = useState("");

  // Synthesize soft alert sounds offline via Web Audio API (Reliable & Asset-free)
  const playAlertSound = (type: "pomo_complete" | "breath_tick") => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      if (type === "pomo_complete") {
        // Multi-frequency bell synth
        const frequencies = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        frequencies.forEach((freq, index) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.12);
          
          gainNode.gain.setValueAtTime(0.12, ctx.currentTime + index * 0.12);
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + index * 0.12 + 0.6);
          
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          
          osc.start(ctx.currentTime + index * 0.12);
          osc.stop(ctx.currentTime + index * 0.12 + 0.6);
        });
      } else if (type === "breath_tick") {
        // Subtle rhythmic heartbeat tick
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.08);
        
        gainNode.gain.setValueAtTime(0.08, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      }
    } catch (err) {
      console.warn("Failed to generate synth sound:", err);
    }
  };

  // --- RECORD POMODORO TO LOCALSTORAGE ---
  const _recordPomoCompleted = () => {
    try {
      const todayStr = new Date().toLocaleDateString('vi-VN');
      const storedHistory = localStorage.getItem("vibe_pomo_history");
      const history = storedHistory ? JSON.parse(storedHistory) : [];
      
      const newSession = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString(),
        dateStr: todayStr,
        deckTitle: deckTitle || "Chung",
        duration: 25 // 25 mins
      };
      
      history.push(newSession);
      localStorage.setItem("vibe_pomo_history", JSON.stringify(history));
      window.dispatchEvent(new Event("vibe_pomo_updated"));
    } catch (err) {
      console.error("Failed to save Pomodoro session stats:", err);
    }
  };

  // --- BREATHING 4-7-8 LIFECYCLE ---
  useEffect(() => {
    if (isBreathingRunning) {
      breathingIntervalRef.current = setInterval(() => {
        setBreathTimeLeft((prev) => {
          if (prev <= 1) {
            // Transition phases
            setBreathPhase((current) => {
              if (current === "inhale") {
                toast.info("Giữ hơi thở lại...");
                return "hold";
              }
              if (current === "hold") {
                toast.info("Thở ra nhẹ nhàng...");
                return "exhale";
              }
              // exhale complete
              playAlertSound("breath_tick");
              toast.info("Hít vào sâu bằng mũi...");
              return "inhale";
            });
            
            // Set respective timer durations: inhale = 4s, hold = 7s, exhale = 8s
            let nextDuration = 4;
            setBreathPhase((current) => {
              if (current === "hold") nextDuration = 7;
              else if (current === "exhale") nextDuration = 8;
              return current;
            });
            return nextDuration;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (breathingIntervalRef.current) clearInterval(breathingIntervalRef.current);
    }
    return () => {
      if (breathingIntervalRef.current) clearInterval(breathingIntervalRef.current);
    };
  }, [isBreathingRunning]);

  useEffect(() => {
    if (!isBreathingRunning) return;
    // Tick subtly on phase changes to assist rhythm
    playAlertSound("breath_tick");
  }, [breathPhase, isBreathingRunning]);

  const toggleBreathingActive = () => {
    const nextState = !isBreathingRunning;
    setIsBreathingRunning(nextState);
    if (nextState) {
      setBreathPhase("inhale");
      setBreathTimeLeft(4);
      toast.info("Chu kỳ điều hòa nhịp thở 4-7-8: Bắt đầu hít vào...");
    }
  };

  // --- CARD & DECK MEMO AUTOSAVE ENGINE ---
  useEffect(() => {
    if (currentCardId) {
      const storedMemo = localStorage.getItem(`vibe_card_memo_${currentCardId}`);
      setCardMemo(storedMemo || "");
    }
  }, [currentCardId]);

  useEffect(() => {
    if (deckTitle) {
      const storedMemo = localStorage.getItem(`vibe_deck_memo_${deckTitle}`);
      setDeckMemo(storedMemo || "");
    }
  }, [deckTitle]);

  const handleCardMemoChange = (val: string) => {
    setCardMemo(val);
    if (currentCardId) {
      localStorage.setItem(`vibe_card_memo_${currentCardId}`, val);
    }
  };

  const handleDeckMemoChange = (val: string) => {
    setDeckMemo(val);
    if (deckTitle) {
      localStorage.setItem(`vibe_deck_memo_${deckTitle}`, val);
    }
  };

  // --- CANVAS DRAWING ACTIONS ---
  useEffect(() => {
    if (isScratchpadOpen && scratchpadTab === "sketch") {
      // Small timeout to let drawer finish animating before calculating size
      const timer = setTimeout(() => {
        initCanvas();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isScratchpadOpen, scratchpadTab]);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    // Set high resolution matching device pixel ratio
    const rect = parent.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = Math.max(rect.height, 350) * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${Math.max(rect.height, 350)}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      redrawStrokes();
    }
  };

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const coords = getCoordinates(e);
    setIsDrawing(true);
    
    const activeColor = isEraser ? "transparent" : brushColor;
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(coords.x, coords.y);
      ctx.strokeStyle = isEraser ? (document.documentElement.classList.contains("dark") ? "#18181b" : "#ffffff") : brushColor;
      ctx.lineWidth = brushWidth;
    }

    const newStroke: Stroke = {
      points: [coords],
      color: activeColor,
      width: brushWidth
    };
    setStrokes((prev) => [...prev, newStroke]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const coords = getCoordinates(e);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    setStrokes((prev) => {
      if (prev.length === 0) return prev;
      const last = { ...prev[prev.length - 1] };
      last.points.push(coords);
      return [...prev.slice(0, -1), last];
    });
  };

  const handlePointerUp = () => {
    setIsDrawing(false);
  };

  const redrawStrokes = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const isDark = document.documentElement.classList.contains("dark");

    strokes.forEach((stroke) => {
      if (stroke.points.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      
      stroke.points.forEach((pt) => {
        ctx.lineTo(pt.x, pt.y);
      });

      ctx.strokeStyle = stroke.color === "transparent" ? (isDark ? "#18181b" : "#ffffff") : stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.stroke();
    });
  };

  useEffect(() => {
    redrawStrokes();
  }, [strokes]);

  const undoLastStroke = () => {
    setStrokes((prev) => prev.slice(0, -1));
  };

  const clearCanvas = () => {
    setStrokes([]);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    toast.success("Đã làm sạch bảng vẽ nháp!");
  };

  // Keyboard shortcut listener ('S' for scratchpad, 'T' for timer when not focusing typing fields)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement?.tagName?.toLowerCase();
      if (activeEl === "input" || activeEl === "textarea") return;

      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        setIsScratchpadOpen(!isScratchpadOpen);
      }
      if (e.key.toLowerCase() === "t") {
        e.preventDefault();
        setIsTimerOpen(!isTimerOpen);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTimerOpen, isScratchpadOpen, setIsTimerOpen, setIsScratchpadOpen]);

  // Format Time Helper
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <>
      {/* 🧘 FEATURE 1: FOCUS COMPANION WIDGET (TIMER & BREATHING) */}
      {isTimerOpen && (
        isMiniPomodoro ? (
          /* ⏱️ MINI COUNTDOWN POPUP (Super Compact) */
          <motion.div 
            drag
            dragMomentum={false}
            whileDrag={{ scale: 1.01, opacity: 0.9 }}
            id="vibe-focus-companion-widget"
            className={cn(
              "fixed bg-zinc-950/95 text-zinc-50 border border-orange-500/40 rounded-full shadow-2xl z-40 px-3.5 py-1.5 backdrop-blur-md animate-in fade-in-50 duration-200 flex items-center gap-2.5 select-none font-mono font-black text-base cursor-grab active:cursor-grabbing",
              "bottom-24 right-20"
            )}
          >
            <span className="text-xs">⏱️</span>
            <span className="tracking-widest font-mono text-sm">{formatTime(timeLeft)}</span>
            
            <div className="flex items-center gap-1 ml-1 border-l border-zinc-800 pl-2 shrink-0">
              <button
                type="button"
                onClick={toggleTimer}
                className={cn(
                  "p-0.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-850 transition cursor-pointer",
                  isActive && "text-orange-400"
                )}
                title={isActive ? "Tạm dừng" : "Bắt đầu"}
              >
                {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setIsMiniPomodoro(false)}
                className="p-0.5 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-850 transition cursor-pointer"
                title="Mở rộng"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsTimerOpen(false)}
                className="p-0.5 rounded-full text-zinc-400 hover:text-red-400 hover:bg-zinc-850 transition cursor-pointer"
                title="Đóng"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        ) : (
          /* FULL COMPANION WIDGET */
          <motion.div 
            drag
            dragMomentum={false}
            whileDrag={{ scale: 1.01, opacity: 0.9 }}
            id="vibe-focus-companion-widget"
            className={cn(
              "fixed w-80 bg-white/95 dark:bg-zinc-900/95 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl z-40 p-4 backdrop-blur-md animate-in fade-in-50 duration-200 flex flex-col gap-3.5 select-none",
              "bottom-24 right-20",
              "cursor-grab active:cursor-grabbing"
            )}
          >
            {/* Thin Drag Handle Indicator */}
            <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-750 rounded-full mx-auto -mt-1.5 mb-1 cursor-grab active:cursor-grabbing" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800/60 pb-2.5">
              <div className="flex bg-zinc-100/80 dark:bg-zinc-800/80 p-0.5 rounded-lg w-full">
                <button
                  type="button"
                  onClick={() => setCompanionTab("pomodoro")}
                  className={cn(
                    "flex-1 text-[11px] font-bold py-1 px-1 rounded-md transition flex items-center justify-center gap-1 cursor-pointer",
                    companionTab === "pomodoro" ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"
                  )}
                >
                  <TimerIcon className="w-3 h-3" /> Pomo
                </button>
                <button
                  type="button"
                  onClick={() => setCompanionTab("breathing")}
                  className={cn(
                    "flex-1 text-[11px] font-bold py-1 px-1 rounded-md transition flex items-center justify-center gap-1 cursor-pointer",
                    companionTab === "breathing" ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"
                  )}
                >
                  <Wind className="w-3 h-3" /> Thở
                </button>
                <button
                  type="button"
                  onClick={() => setCompanionTab("stats")}
                  className={cn(
                    "flex-1 text-[11px] font-bold py-1 px-1 rounded-md transition flex items-center justify-center gap-1 cursor-pointer",
                    companionTab === "stats" ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"
                  )}
                >
                  <BarChart2 className="w-3 h-3" /> T.Kê
                </button>
              </div>
              
              {companionTab === "pomodoro" && (
                <button
                  type="button"
                  onClick={() => setIsMiniPomodoro(true)}
                  className="ml-2.5 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-md hover:bg-zinc-150 dark:hover:bg-zinc-800 transition cursor-pointer"
                  title="Thu nhỏ thành Popup"
                >
                  <Minimize2 className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsTimerOpen(false)}
                className="ml-1 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-md hover:bg-zinc-150 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tab 1: Pomodoro Timer */}
            {companionTab === "pomodoro" && (
              <div className="space-y-4">
                {/* Duration options */}
                <div className="grid grid-cols-3 gap-1.5 text-[10px] font-extrabold text-center uppercase tracking-wide">
                  <button
                    type="button"
                    onClick={() => setWorkTimeMinutes(25)}
                    className={cn(
                      "py-1.5 rounded-md border transition cursor-pointer",
                      mode === "work" ? "bg-orange-500 text-black border-orange-500 font-black" : "border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-850"
                    )}
                  >
                    Học 25m
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkTimeMinutes(5)}
                    className={cn(
                      "py-1.5 rounded-md border transition cursor-pointer",
                      false /* short handled globally */ ? "bg-orange-500 text-black border-orange-500 font-black" : "border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-850"
                    )}
                  >
                    Nghỉ 5m
                  </button>
                  <button
                    type="button"
                    onClick={() => setWorkTimeMinutes(60)}
                    className={cn(
                      "py-1.5 rounded-md border transition cursor-pointer",
                      false /* long handled globally */ ? "bg-orange-500 text-black border-orange-500 font-black" : "border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-850"
                    )}
                  >
                    Nghỉ 15m
                  </button>
                </div>

                {/* Time Display */}
                <div className="text-center py-2 relative">
                  <div className="text-5xl font-mono font-black tracking-widest text-zinc-800 dark:text-zinc-100 flex justify-center items-center">
                    {formatTime(timeLeft)}
                  </div>
                  <div className="text-[10px] font-bold text-zinc-400 mt-1 uppercase tracking-widest">
                    {mode === "work" ? "⏱️ Tập trung tối đa" : "☕ Thư giãn đầu óc"}
                  </div>
                </div>

                {/* Timer Controls */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleTimer}
                    className={cn(
                      "flex-1 py-2 px-4 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-sm",
                      isActive ? "bg-red-500 hover:bg-red-600 text-white" : "bg-orange-500 hover:bg-orange-600 text-black"
                    )}
                  >
                    {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    {isActive ? "Tạm dừng" : "Bắt đầu"}
                  </button>
                  <button
                    type="button"
                    onClick={stopTimer}
                    className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                    title="Đặt lại"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: 4-7-8 Breathing */}
            {companionTab === "breathing" && (
              <div className="space-y-4 flex flex-col items-center">
                {/* Breathing Circle Visualization */}
                <div className="relative w-36 h-36 flex items-center justify-center mt-2">
                  {/* Visual expansion pulse ring based on state */}
                  <div 
                    className={cn(
                      "absolute inset-0 rounded-full transition-all ease-in-out border border-dashed border-orange-500/30",
                      isBreathingRunning && breathPhase === "inhale" && "animate-ping",
                      isBreathingRunning && breathPhase === "exhale" && "opacity-20 scale-50"
                    )}
                  />
                  <div 
                    className={cn(
                      "rounded-full flex flex-col items-center justify-center text-center shadow-lg transition-all duration-[1000ms] ease-in-out border relative",
                      breathPhase === "inhale" ? "w-28 h-28 bg-sky-500/10 border-sky-400/30 text-sky-600 dark:text-sky-400 scale-110" : "",
                      breathPhase === "hold" ? "w-32 h-32 bg-amber-500/10 border-amber-400/30 text-amber-600 dark:text-amber-400 scale-125" : "",
                      breathPhase === "exhale" ? "w-24 h-24 bg-emerald-500/10 border-emerald-400/30 text-emerald-600 dark:text-emerald-400 scale-90" : "",
                      !isBreathingRunning && "w-28 h-28 bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-300 dark:border-zinc-700"
                    )}
                  >
                    <span className="text-[10px] font-black tracking-widest uppercase mb-1 opacity-85">
                      {!isBreathingRunning ? "Sẵn sàng" : breathPhase === "inhale" ? "HÍT VÀO" : breathPhase === "hold" ? "GIỮ HƠI" : "THỞ RA"}
                    </span>
                    <span className="text-3xl font-display font-black tracking-wider leading-none">
                      {!isBreathingRunning ? "🧘" : breathTimeLeft}
                    </span>
                  </div>
                </div>

                {/* Instructions text */}
                <div className="text-center max-w-[240px]">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-semibold">
                    {!isBreathingRunning 
                      ? "Kỹ thuật 4-7-8 giúp xoa dịu thần kinh, đưa não bộ về trạng thái tập trung sâu."
                      : breathPhase === "inhale" 
                      ? "Hít nhẹ nhàng qua mũi trong 4 giây."
                      : breathPhase === "hold"
                      ? "Nín thở và giữ yên lồng ngực trong 7 giây."
                      : "Thở ra chậm rãi qua miệng tạo tiếng rít khẽ trong 8 giây."
                    }
                  </p>
                </div>

                {/* Action play */}
                <button
                  type="button"
                  onClick={toggleBreathingActive}
                  className={cn(
                    "w-full py-2 px-4 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-sm mt-1",
                    isBreathingRunning ? "bg-zinc-600 hover:bg-zinc-700 text-white" : "bg-orange-500 hover:bg-orange-600 text-black"
                  )}
                >
                  {isBreathingRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  {isBreathingRunning ? "Tạm dừng tập" : "Bắt đầu luyện thở"}
                </button>
              </div>
            )}

            {/* Tab 3: Pomodoro Cumulative Stats & Chart */}
            {companionTab === "stats" && (
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                <VibePomodoroStats currentDeckTitle={deckTitle} />
              </div>
            )}
          </motion.div>
        )
      )}

      {/* 🎨 FEATURE 3: INTELLIGENT DRAWER PANEL (SKETCHPAD & MEMO) */}
      <div
        id="vibe-scratchpad-drawer"
        className={cn(
          "fixed top-0 right-0 h-full w-80 sm:w-96 bg-white dark:bg-zinc-950 shadow-2xl border-l border-zinc-200 dark:border-zinc-900 z-50 flex flex-col transition-all duration-300 ease-in-out",
          isScratchpadOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
        )}
      >
        {/* Drawer Header with tabs */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-900 flex flex-col gap-3 shrink-0 bg-zinc-50/50 dark:bg-zinc-900/30">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black font-display text-zinc-800 dark:text-zinc-200 flex items-center gap-2 uppercase tracking-wider">
              <Palette className="w-4 h-4 text-orange-500" /> Bảng học siêu tốc
            </h3>
            <button
              type="button"
              onClick={() => setIsScratchpadOpen(false)}
              className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          <div className="flex bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-lg text-xs font-bold">
            <button
              type="button"
              onClick={() => setScratchpadTab("sketch")}
              className={cn(
                "flex-1 py-1.5 rounded-md transition cursor-pointer text-center",
                scratchpadTab === "sketch" ? "bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"
              )}
            >
              🖌️ Bảng vẽ nháp
            </button>
            <button
              type="button"
              onClick={() => setScratchpadTab("memo")}
              className={cn(
                "flex-1 py-1.5 rounded-md transition cursor-pointer text-center relative",
                scratchpadTab === "memo" ? "bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"
              )}
            >
              📝 Ghi chú mẹo
              {cardMemo.trim() !== "" && (
                <span className="absolute top-1.5 right-3 w-1.5 h-1.5 bg-orange-500 rounded-full" />
              )}
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          {/* TAB A: SKETCHPAD CANVAS */}
          {scratchpadTab === "sketch" && (
            <div className="flex-1 flex flex-col p-4 overflow-hidden gap-3">
              <div className="text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed font-semibold">
                ✍️ Vẽ nháp, công thức, từ Kanji/Hanzi bằng chuột hoặc màn hình cảm ứng để ghi nhớ hiệu quả hơn.
              </div>

              {/* Drawing Area */}
              <div className="flex-1 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-250 dark:border-zinc-900 overflow-hidden relative min-h-[300px]">
                <canvas
                  ref={canvasRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  className="absolute inset-0 cursor-crosshair touch-none"
                />
              </div>

              {/* Canvas Toolbar Controls */}
              <div className="space-y-3 pt-2">
                {/* Pen color selectors & width */}
                <div className="flex items-center justify-between gap-3 bg-zinc-50 dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-900 text-xs">
                  <div className="flex items-center gap-1.5">
                    {["#f97316", "#ef4444", "#3b82f6", "#22c55e", "#a855f7"].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => {
                          setBrushColor(color);
                          setIsEraser(false);
                        }}
                        className={cn(
                          "w-5 h-5 rounded-full border transition cursor-pointer",
                          !isEraser && brushColor === color ? "scale-125 border-zinc-950 dark:border-white ring-2 ring-orange-500/20" : "border-transparent"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    {/* Dark/Light mode chalk helper */}
                    <button
                      type="button"
                      onClick={() => {
                        setBrushColor(document.documentElement.classList.contains("dark") ? "#f4f4f5" : "#18181b");
                        setIsEraser(false);
                      }}
                      className={cn(
                        "w-5 h-5 rounded-full border transition cursor-pointer flex items-center justify-center text-[10px]",
                        !isEraser && (brushColor === "#f4f4f5" || brushColor === "#18181b") ? "scale-125 border-zinc-950 dark:border-white" : "border-transparent bg-zinc-200 dark:bg-zinc-700"
                      )}
                      title="Nét phấn cơ bản"
                    >
                      🎨
                    </button>
                  </div>

                  {/* Width slider */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-zinc-400">Nét</span>
                    <input
                      type="range"
                      min="1"
                      max="12"
                      value={brushWidth}
                      onChange={(e) => setBrushWidth(Number(e.target.value))}
                      className="w-16 accent-orange-500 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>

                {/* Clear / Undo actions */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEraser(!isEraser)}
                    className={cn(
                      "py-2 px-2.5 rounded-xl text-[11px] font-bold border transition flex items-center justify-center gap-1.5 cursor-pointer",
                      isEraser 
                        ? "bg-orange-500/10 border-orange-500 text-orange-500 font-extrabold" 
                        : "border-zinc-200 dark:border-zinc-900 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    )}
                  >
                    🗑️ {isEraser ? "Tẩy: Bật" : "Tẩy"}
                  </button>
                  <button
                    type="button"
                    onClick={undoLastStroke}
                    disabled={strokes.length === 0}
                    className="py-2 px-2.5 rounded-xl text-[11px] font-bold border border-zinc-200 dark:border-zinc-900 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    <Undo className="w-3.5 h-3.5" /> Hoàn tác
                  </button>
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="py-2 px-2.5 rounded-xl text-[11px] font-bold bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/20 text-red-600 dark:text-red-400 transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Làm sạch
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB B: AUTOSAVING MNEMONIC MEMOS */}
          {scratchpadTab === "memo" && (
            <div className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto custom-scrollbar">
              {/* Card level memo */}
              <div className="space-y-2 flex flex-col">
                <label className="text-[11px] font-extrabold text-orange-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5" /> Gợi nhớ Thẻ hiện tại (Card Mnemonic)
                </label>
                <div className="text-[10px] text-zinc-400 font-semibold leading-normal pb-1">
                  💡 Ghi chú này sẽ **chỉ hiển thị khi bạn xem đúng chiếc thẻ này**. Phù hợp để ghi mẹo liên tưởng, từ đồng nghĩa hoặc quy tắc nhớ.
                </div>
                <textarea
                  value={cardMemo}
                  onChange={(e) => handleCardMemoChange(e.target.value)}
                  placeholder="Gõ công thức, mẹo nhớ, ví dụ tự chế của riêng bạn tại đây..."
                  className="w-full h-32 p-3 text-xs bg-zinc-50 dark:bg-zinc-900/60 text-zinc-800 dark:text-zinc-200 border border-zinc-250 dark:border-zinc-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 resize-none font-medium placeholder:italic"
                />
                <div className="flex justify-end text-[10px] font-bold text-green-600 dark:text-green-400 flex items-center gap-1 self-end">
                  <Check className="w-3 h-3" /> Đã tự động lưu local
                </div>
              </div>

              {/* Deck level memo */}
              <div className="space-y-2 flex flex-col border-t border-zinc-200/50 dark:border-zinc-900/60 pt-4 mt-1">
                <label className="text-[11px] font-extrabold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  📚 Ghi chú chung của Bộ học (Deck Memo)
                </label>
                <textarea
                  value={deckMemo}
                  onChange={(e) => handleDeckMemoChange(e.target.value)}
                  placeholder="Lưu trữ kiến thức chung, dàn ý ôn tập của toàn bộ bộ học này..."
                  className="w-full h-40 p-3 text-xs bg-zinc-50 dark:bg-zinc-900/60 text-zinc-800 dark:text-zinc-200 border border-zinc-250 dark:border-zinc-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/30 resize-none font-medium"
                />
                <div className="flex justify-end text-[10px] font-bold text-green-600 dark:text-green-400 flex items-center gap-1 self-end">
                  <Check className="w-3 h-3" /> Đã lưu vào bộ học
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
