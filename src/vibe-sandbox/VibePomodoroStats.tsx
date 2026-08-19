import React, { useState, useEffect } from "react";
import { 
  BarChart2, Calendar, Clock, Trash2, Plus, RefreshCw, Trophy, BookOpen, AlertCircle
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { toast } from "sonner";
import { cn } from "../lib/utils";

interface PomoSession {
  id: string;
  timestamp: string;
  dateStr: string;
  deckTitle: string;
  duration: number;
}

interface VibePomodoroStatsProps {
  currentDeckTitle?: string;
}

export const VibePomodoroStats: React.FC<VibePomodoroStatsProps> = ({ 
  currentDeckTitle = "Chung" 
}) => {
  const [history, setHistory] = useState<PomoSession[]>([]);

  const loadHistory = () => {
    try {
      const stored = localStorage.getItem("vibe_pomo_history");
      if (stored) {
        setHistory(JSON.parse(stored));
      } else {
        setHistory([]);
      }
    } catch (err) {
      console.error("Failed to load Pomodoro history:", err);
    }
  };

  useEffect(() => {
    loadHistory();

    // Listen for custom update events from VibeStudyCompanion
    const handleUpdate = () => {
      loadHistory();
    };

    window.addEventListener("vibe_pomo_updated", handleUpdate);
    return () => {
      window.removeEventListener("vibe_pomo_updated", handleUpdate);
    };
  }, []);

  // Simulate a completed session for testing / demonstration purposes
  const simulateSession = (daysAgo: number = 0) => {
    try {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - daysAgo);
      const dateStr = targetDate.toLocaleDateString("vi-VN");

      const newSession: PomoSession = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: targetDate.toISOString(),
        dateStr,
        deckTitle: currentDeckTitle || "Chung",
        duration: 25
      };

      const updated = [...history, newSession];
      localStorage.setItem("vibe_pomo_history", JSON.stringify(updated));
      setHistory(updated);
      window.dispatchEvent(new Event("vibe_pomo_updated"));
      toast.success(`Đã thêm giả lập 1 phiên Pomodoro hoàn thành (${dateStr})!`);
    } catch (err) {
      toast.error("Không thể lưu phiên giả lập.");
    }
  };

  const clearAllHistory = () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử Pomodoro? Hành động này không thể hoàn tác!")) {
      localStorage.removeItem("vibe_pomo_history");
      setHistory([]);
      window.dispatchEvent(new Event("vibe_pomo_updated"));
      toast.success("Đã xóa sạch lịch sử Pomodoro.");
    }
  };

  const deleteSession = (id: string) => {
    const updated = history.filter(s => s.id !== id);
    localStorage.setItem("vibe_pomo_history", JSON.stringify(updated));
    setHistory(updated);
    window.dispatchEvent(new Event("vibe_pomo_updated"));
    toast.success("Đã xóa phiên học.");
  };

  // --- COMPUTE STATISTICS ---
  const totalSessions = history.length;
  const totalMinutes = history.reduce((acc, curr) => acc + curr.duration, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  // Today count
  const todayStr = new Date().toLocaleDateString("vi-VN");
  const sessionsToday = history.filter(s => s.dateStr === todayStr).length;

  // Current deck count
  const sessionsCurrentDeck = history.filter(
    s => s.deckTitle.toLowerCase() === currentDeckTitle.toLowerCase()
  ).length;

  // --- PREPARE CHART DATA (Last 7 Days) ---
  const getChartData = () => {
    const data = [];
    const weekdays = ["Chủ Nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toLocaleDateString("vi-VN");
      const label = i === 0 ? "Hôm nay" : weekdays[d.getDay()];
      
      const count = history.filter(s => s.dateStr === dateString).length;
      data.push({
        name: label,
        sessions: count,
        minutes: count * 25,
        date: dateString
      });
    }
    return data;
  };

  const chartData = getChartData();

  return (
    <div className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-2xl p-4 sm:p-5 mb-5 shadow-sm animate-in fade-in slide-in-from-top-3 duration-300">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-100 dark:border-zinc-850 pb-4 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-xl">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base sm:text-lg text-zinc-900 dark:text-zinc-50 font-display">
              Báo Cáo Thống Kê Pomodoro
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold">
              Theo dõi chu kỳ học tập tập trung tích lũy của bạn
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          {/* Quick Mock generator for testing */}
          <div className="dropdown relative group">
            <button
              type="button"
              className="py-1.5 px-2.5 bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-950 text-xs font-bold rounded-lg hover:bg-zinc-800 dark:hover:bg-zinc-200 transition flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Giả Lập Học
            </button>
            <div className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-50 p-1 hidden group-hover:block animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={() => simulateSession(0)}
                className="w-full text-left py-2 px-3 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg font-bold text-zinc-700 dark:text-zinc-300 transition"
              >
                Hôm nay (+25p)
              </button>
              <button
                onClick={() => simulateSession(1)}
                className="w-full text-left py-2 px-3 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg font-bold text-zinc-700 dark:text-zinc-300 transition"
              >
                Hôm qua (+25p)
              </button>
              <button
                onClick={() => simulateSession(2)}
                className="w-full text-left py-2 px-3 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg font-bold text-zinc-700 dark:text-zinc-300 transition"
              >
                2 ngày trước (+25p)
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={loadHistory}
            className="p-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-600 dark:text-zinc-300 rounded-lg transition"
            title="Làm mới"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Grid KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        
        {/* KPI 1 */}
        <div className="bg-zinc-50/50 dark:bg-zinc-900/40 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80 flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider flex items-center gap-1">
            <Trophy className="w-3 h-3 text-zinc-800 dark:text-zinc-200" /> Tổng chu kỳ
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-mono font-black text-zinc-900 dark:text-zinc-50">
              {totalSessions}
            </span>
            <span className="text-xs text-zinc-500">phiên</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-zinc-50/50 dark:bg-zinc-900/40 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80 flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider flex items-center gap-1">
            <Clock className="w-3 h-3 text-zinc-800 dark:text-zinc-200" /> Tổng thời gian
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-mono font-black text-zinc-900 dark:text-zinc-50">
              {totalHours}
            </span>
            <span className="text-xs text-zinc-500">giờ</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-zinc-50/50 dark:bg-zinc-900/40 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80 flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider flex items-center gap-1">
            <Calendar className="w-3 h-3 text-zinc-800 dark:text-zinc-200" /> Hôm nay
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-mono font-black text-zinc-900 dark:text-zinc-50">
              {sessionsToday}
            </span>
            <span className="text-xs text-zinc-500">phiên</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-zinc-50/50 dark:bg-zinc-900/40 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80 flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider flex items-center gap-1">
            <BookOpen className="w-3 h-3 text-zinc-800 dark:text-zinc-200" /> Bộ hiện tại
          </span>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-mono font-black text-zinc-900 dark:text-zinc-50">
              {sessionsCurrentDeck}
            </span>
            <span className="text-xs text-zinc-500">phiên</span>
          </div>
        </div>

      </div>

      {/* Recharts Bar Chart block */}
      <div className="bg-zinc-50/30 dark:bg-zinc-900/10 p-3 sm:p-4 rounded-xl border border-zinc-100 dark:border-zinc-850 mb-5">
        <h4 className="text-xs font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider mb-3">
          📊 Biểu đồ 7 ngày gần nhất (Chu kỳ Pomodoro)
        </h4>
        <div className="w-full h-48 sm:h-56">
          {totalSessions === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-600">
              <AlertCircle className="w-8 h-8 mb-1.5 opacity-60" />
              <p className="text-xs font-bold">Chưa có chu kỳ Pomodoro nào được ghi nhận</p>
              <p className="text-[10px]">Hãy bắt đầu học hoặc dùng nút Giả Lập ở trên để xem biểu đồ</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                <XAxis 
                  dataKey="name" 
                  tickLine={false} 
                  axisLine={false}
                  tick={{ fill: "#71717a", fontSize: 10, fontWeight: "bold" }}
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false}
                  allowDecimals={false}
                  tick={{ fill: "#71717a", fontSize: 10, fontWeight: "bold" }}
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(0, 0, 0, 0.04)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white dark:bg-zinc-900 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl text-xs font-semibold">
                          <p className="text-[10px] text-zinc-400 font-bold mb-1">{data.date}</p>
                          <p className="text-zinc-900 dark:text-zinc-100">
                            Số phiên: <span className="font-extrabold text-zinc-900 dark:text-zinc-50">{data.sessions} chu kỳ</span>
                          </p>
                          <p className="text-zinc-500 dark:text-zinc-400">
                            Thời gian: <span className="font-extrabold text-zinc-900 dark:text-zinc-50">{data.minutes} phút</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="sessions" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      // Dynamic color depending on dark vs light mode elements via tailwind properties inside class
                      className={cn(
                        "transition-all duration-350 cursor-pointer",
                        entry.sessions > 0 
                          ? "fill-zinc-900 dark:fill-zinc-100" 
                          : "fill-zinc-200 dark:fill-zinc-800"
                      )}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Lịch sử gần đây */}
      {history.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">
              📜 Nhật ký tập trung gần đây
            </h4>
            <button
              onClick={clearAllHistory}
              className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" /> Xóa sạch lịch sử
            </button>
          </div>

          <div className="max-h-36 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/80 pr-1 select-none">
            {history.slice().reverse().map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2 text-xs">
                <div className="flex flex-col">
                  <span className="font-bold text-zinc-900 dark:text-zinc-50">
                    Sử dụng Pomodoro: <span className="text-zinc-950 dark:text-white font-mono font-black underline decoration-2">{s.duration} phút</span>
                  </span>
                  <span className="text-[10px] text-zinc-400 font-semibold flex items-center gap-1 mt-0.5">
                    <span>{new Date(s.timestamp).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })} - {s.dateStr}</span>
                    <span>•</span>
                    <span className="text-zinc-500 dark:text-zinc-400 font-bold">{s.deckTitle}</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => deleteSession(s.id)}
                  className="p-1 text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition rounded hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer"
                  title="Xóa nhật ký này"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
