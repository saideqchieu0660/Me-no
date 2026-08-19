import React, { useState, useEffect } from "react";
import { Server, Activity, AlertTriangle, ShieldCheck, XCircle, Clock } from "lucide-react";

interface VibeKeyState {
  id: string;
  maskedKey: string;
  status: "GREEN" | "YELLOW" | "RED";
  recoveryTime: number | null;
  usageCount: number;
}

export default function VibeApiHealthMonitor() {
  const [keys, setKeys] = useState<VibeKeyState[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchKeys = async () => {
    try {
      const res = await fetch("/api/vibe/keys-status");
      const data = await res.json();
      setKeys(data.keys || []);
    } catch (err) {
      console.error("Failed to fetch vibe keys", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
    const interval = setInterval(fetchKeys, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleTestRequest = async (type: 'success' | '429' | '403') => {
    try {
      await fetch("/api/vibe/test-rotator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type })
      });
      fetchKeys();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <Server className="w-8 h-8 text-indigo-500" />
          <div>
            <h1 className="text-2xl font-bold">Vibe API Ingestion Rotator</h1>
            <p className="text-sm text-zinc-500">Persistent State Machine & Health Dashboard</p>
          </div>
        </div>
        <div className="flex gap-2">
           <button onClick={() => handleTestRequest('success')} className="px-3 py-1.5 text-xs font-bold bg-green-500 hover:bg-green-600 text-white rounded">
             Test Success
           </button>
           <button onClick={() => handleTestRequest('429')} className="px-3 py-1.5 text-xs font-bold bg-yellow-500 hover:bg-yellow-600 text-white rounded">
             Test 429 (Yellow)
           </button>
           <button onClick={() => handleTestRequest('403')} className="px-3 py-1.5 text-xs font-bold bg-red-500 hover:bg-red-600 text-white rounded">
             Test 403 (Red)
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && <div className="text-zinc-500">Đang tải dữ liệu Cluster...</div>}
        {!loading && keys.map(k => (
          <div key={k.id} className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 bg-zinc-50 dark:bg-zinc-900 shadow-sm relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
              <div className="font-mono text-sm font-bold text-zinc-700 dark:text-zinc-300">
                {k.maskedKey}
              </div>
              <StatusBadge status={k.status} recoveryTime={k.recoveryTime} />
            </div>
            
            <div className="text-xs text-zinc-500 flex items-center gap-1 mt-4">
              <Activity className="w-3 h-3" /> Requests served: <span className="font-bold">{k.usageCount}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status, recoveryTime }: { status: string; recoveryTime: number | null }) {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (status !== "YELLOW" || !recoveryTime) return;
    const updateTime = () => {
      const remaining = Math.max(0, Math.ceil((recoveryTime - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    updateTime();
    const int = setInterval(updateTime, 1000);
    return () => clearInterval(int);
  }, [status, recoveryTime]);

  if (status === "GREEN") {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 text-xs font-bold">
        <ShieldCheck className="w-3.5 h-3.5" /> ACTIVE
      </div>
    );
  }
  if (status === "YELLOW") {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400 text-xs font-bold">
        <Clock className="w-3.5 h-3.5" /> COOLDOWN {timeLeft}s
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 text-xs font-bold">
      <XCircle className="w-3.5 h-3.5" /> BANNED
    </div>
  );
}
