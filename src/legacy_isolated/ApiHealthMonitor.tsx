import { toast } from "sonner";
import React, { useState, useEffect, useRef } from "react";
import {
  Key,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  ListOrdered,
  Server,
  Globe,
  Cpu,
  Activity,
  Zap,
} from "lucide-react";
import * as d3 from "d3";
import { store } from "../lib/store";
import { useSystemConfig } from "../hooks/useSystemConfig";
import { rotationEngine, KeyStatus } from "./hybridRotationEngine";

class MonitorErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError)
      return (
        <div className="p-8 text-center text-red-500">
          Service Monitor unavailable.
        </div>
      );
    return this.props.children;
  }
}

function D3Sparkline({ data, color }: { data: number[]; color: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const width = 80;
    const height = 24;
    const margin = { top: 2, right: 4, bottom: 2, left: 2 };

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const x = d3
      .scaleLinear()
      .domain([0, data.length - 1])
      .range([margin.left, width - margin.right]);

    const yMax = Math.max(d3.max(data) || 0, 1) + 1; // At least 2 to give some headroom
    const y = d3
      .scaleLinear()
      .domain([0, yMax])
      .range([height - margin.bottom, margin.top]);

    const line = d3
      .line<number>()
      .x((_, i) => x(i))
      .y((d) => y(d))
      .curve(d3.curveMonotoneX);

    svg
      .append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-width", 1.5)
      .attr("stroke-linecap", "round")
      .attr("d", line);

    // Add dot at the end
    svg
      .append("circle")
      .attr("cx", x(data.length - 1))
      .attr("cy", y(data[data.length - 1]))
      .attr("r", 2.5)
      .attr("fill", color);
  }, [data, color]);

  return (
    <div className="flex flex-col items-end">
      <svg ref={svgRef} width={80} height={24} className="overflow-visible" />
    </div>
  );
}

export function ServiceMonitor({
  isOpen = true,
}: {
  isOpen?: boolean;
}) {
  const [keys, setKeys] = useState<KeyStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Toggles state
  const [cerebrasEnabled, setCerebrasEnabled] = useState(rotationEngine.enableCerebras);
  const [geminiEnabled, setGeminiEnabled] = useState(rotationEngine.enableGemini);
  const [isUpdatingToggles, setIsUpdatingToggles] = useState(false);

  const [usageHistory, setUsageHistory] = useState<Record<string, any>>({});
  
  const [activeTab, setActiveTab] = useState<"monitor" | "logs" | "health">("monitor");

  const { config, updateConfig } = useSystemConfig();
  const [editingEmail, setEditingEmail] = useState("");
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  useEffect(() => {
    if (config?.supportEmail) {
      setEditingEmail(config.supportEmail);
    }
  }, [config?.supportEmail]);

  const handleSaveEmail = async () => {
    setIsSavingEmail(true);
    try {
      await updateConfig({ supportEmail: editingEmail });
      setIsEditingEmail(false);
      toast("Đã cập nhật email hỗ trợ thành công!");
    } catch (e: any) {
      toast("Cập nhật thất bại: " + e.message);
    } finally {
      setIsSavingEmail(false);
    }
  };

  const [testResponse, setTestResponse] = useState<any>(null);
  const [isTestingHealth, setIsTestingHealth] = useState(false);

  const testApiHealth = async () => {
    setIsTestingHealth(true);
    setTestResponse(null);
    try {
      const start = Date.now();
      const res = await fetch("/api/health");
      const duration = Date.now() - start;
      const data = await res.json();
      setTestResponse({
        httpStatus: res.status,
        latencyMs: duration,
        payload: data,
      });
    } catch (err: any) {
      setTestResponse({
        error: err.message || "Failed to contact /api/health",
      });
    } finally {
      setIsTestingHealth(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const fetchKeys = () => {
      const currentKeys = rotationEngine.getKeysStatus();
      setKeys(currentKeys);
      
      setUsageHistory(prev => {
        const next = { ...prev };
        currentKeys.forEach(k => {
          const id = `${k.provider}-${k.index}`;
          if (!next[id]) next[id] = Array(20).fill(0);
          
          // Compute delta purely for visual activity tracking based on usage count
          const prevCount = next[`${id}_count`] || 0;
          const delta = Math.max(0, k.usageCount - prevCount);
          next[`${id}_count`] = k.usageCount;
          
          if (delta > 0 || Math.random() < 0.1) {
             next[id] = [...next[id].slice(1), delta];
          }
        });
        return next;
      });
      setIsLoading(false);
    };

    fetchKeys();
    const interval = setInterval(fetchKeys, 2000);
    return () => clearInterval(interval);
  }, [isOpen]);

  const handleToggleChange = async (provider: 'cerebras' | 'gemini', newValue: boolean) => {
    const isSysAdmin = store.getCurrentUser()?.role === "admin" || store.getCurrentUser()?.role === "Admin";
    if (!isSysAdmin) {
      toast.error("Access Denied: Administrative privileges required.");
      return;
    }

    setIsUpdatingToggles(true);

    try {
      if (newValue) {
        toast.loading(`Verifying ${provider} cluster connectivity...`, { id: 'handshake' });
        const isOk = await rotationEngine.verifyHandshake(provider);
        if (!isOk) {
          toast.error(`${provider} Cluster Unreachable - Verification Failed`, { id: 'handshake' });
          if (provider === 'cerebras') setCerebrasEnabled(false);
          if (provider === 'gemini') setGeminiEnabled(false);
          rotationEngine.setToggles(provider === 'cerebras' ? false : cerebrasEnabled, provider === 'gemini' ? false : geminiEnabled);
          setIsUpdatingToggles(false);
          return;
        }
        toast.success(`${provider} Cluster Verified & Active`, { id: 'handshake' });
      }

      if (provider === 'cerebras') setCerebrasEnabled(newValue);
      if (provider === 'gemini') setGeminiEnabled(newValue);
      
      rotationEngine.setToggles(
        provider === 'cerebras' ? newValue : cerebrasEnabled,
        provider === 'gemini' ? newValue : geminiEnabled
      );

    } catch (err: any) {
      toast.error("Toggle update failed: " + err.message);
    } finally {
      setIsUpdatingToggles(false);
    }
  };

  const activeCount = keys.filter((k) => k.status === "READY" || k.status === "COOLING_DOWN").length;
  const isolatedCount = keys.filter((k) => k.status === "ISOLATED").length;
  const healthScore = keys.length === 0 ? 0 : Math.round((activeCount / keys.length) * 100);
  const isKeysEmpty = keys.length === 0;

  if (isLoading) {
    return <div className="p-12 flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-zinc-400" /></div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SCORE GAUGE */}
        <div className="card-3d p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col items-center justify-center text-center">
          <div className="text-sm font-bold opacity-60 uppercase mb-2">Cluster Health Score</div>
          <div className="text-5xl font-display font-bold mb-2">
            <span className={healthScore >= 80 ? "text-green-500" : healthScore >= 50 ? "text-orange-500" : "text-red-500"}>
              {healthScore}%
            </span>
          </div>
          
          <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-2 mt-4 overflow-hidden flex">
            {keys.length > 0 && (
              <>
                <div
                  className="h-full bg-green-500 transition-all duration-500"
                  style={{ width: `${(activeCount / keys.length) * 100}%` }}
                ></div>
                <div
                  className="h-full bg-red-500 transition-all duration-500"
                  style={{ width: `${(isolatedCount / keys.length) * 100}%` }}
                ></div>
              </>
            )}
          </div>
          
          <div className="flex gap-4 justify-center mt-4 text-xs w-full font-mono font-bold text-zinc-500">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> {activeCount} READY</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> {isolatedCount} ISOLATED</div>
          </div>
        </div>

        {/* TOGGLES */}
        <div className="card-3d p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 lg:col-span-2 space-y-4">
          <h3 className="font-bold text-lg mb-4 border-b border-zinc-200 dark:border-zinc-800 pb-2">Production Cluster Routing</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Cerebras Toggle */}
            <div className="flex items-center justify-between p-4 border rounded-xl dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 dark:bg-orange-900/30 flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold">Cerebras Infrastructure Cluster</div>
                  <div className="text-xs text-zinc-500 font-mono mt-0.5">Llama 3.1 8B (Speed Optimized)</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={cerebrasEnabled} 
                  disabled={isUpdatingToggles}
                  onChange={(e) => handleToggleChange('cerebras', e.target.checked)} 
                />
                <div className="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-orange-500"></div>
              </label>
            </div>

            {/* Gemini Toggle */}
            <div className="flex items-center justify-between p-4 border rounded-xl dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 flex items-center justify-center">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold">Google AI Studio Cluster</div>
                  <div className="text-xs text-zinc-500 font-mono mt-0.5">Gemini 1.5 Flash (Context Optimized)</div>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer ml-4">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={geminiEnabled} 
                  disabled={isUpdatingToggles}
                  onChange={(e) => handleToggleChange('gemini', e.target.checked)} 
                />
                <div className="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-zinc-600 peer-checked:bg-blue-500"></div>
              </label>
            </div>

          </div>
          
           {/* Email Setting within the same block for symmetry */}
           <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <label className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                Support Email (Nhận báo cáo lỗi)
              </label>
              <div className="flex gap-2 w-full max-w-md">
                <input
                  type="email"
                  value={
                    isEditingEmail ? editingEmail : config?.supportEmail || ""
                  }
                  disabled={!isEditingEmail}
                  onChange={(e) => setEditingEmail(e.target.value)}
                  className="flex-1 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="admin@example.com"
                />
                {isEditingEmail ? (
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveEmail}
                      disabled={isSavingEmail}
                      className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center justify-center transition-all"
                    >
                      {isSavingEmail ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Lưu"
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingEmail(false);
                        setEditingEmail(config?.supportEmail || "");
                      }}
                      className="bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 px-4 py-2 rounded-lg text-sm font-bold transition-all"
                    >
                      Huỷ
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsEditingEmail(true)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all"
                  >
                    Sửa
                  </button>
                )}
              </div>
            </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 mb-6">
        <button
          onClick={() => setActiveTab("monitor")}
          className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${
            activeTab === "monitor"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" /> Monitor Grid
          </div>
        </button>
        <button
          onClick={() => setActiveTab("health")}
          className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${
            activeTab === "health"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4" /> System Info
          </div>
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${
            activeTab === "logs"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <ListOrdered className="w-4 h-4" /> Rotation Logs
          </div>
        </button>
      </div>
      
      {activeTab === "monitor" && (
      <>
        {isKeysEmpty && (
            <div className="flex flex-col items-center justify-center p-16 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-2">
                <Key className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="font-serif italic text-3xl font-medium text-zinc-900 dark:text-zinc-100">
                Khoá hệ thống đã cạn kiệt
              </h3>
              <p className="text-zinc-500 max-w-md mx-auto tracking-wide font-light">
                Tất cả các hàng đợi API đều đang trống. Vui lòng cấu hình các khoá bí mật <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-red-500 font-mono text-xs">VITE_CEREBRAS_KEY_X</code> hoặc <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-red-500 font-mono text-xs">VITE_GEMINI_API_KEY_X</code>.
              </p>
            </div>
        )}

      {/* GRID */}
      <div className="space-y-4 pt-4">
        <div className="border-b border-zinc-200 dark:border-zinc-800 pb-2 flex justify-between items-end">
          <div>
            <h3 className="text-xl font-bold font-display flex items-center gap-2">
              Unified Hybrid Rotation Pool 
              <span className="text-xs bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 rounded-full font-mono">
                {keys.length} keys active
              </span>
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Live deterministic Round-Robin execution state. (10-12s cooldown enforced).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {keys.map((k) => {
            const isProviderDisabled = (k.provider === 'cerebras' && !cerebrasEnabled) || (k.provider === 'gemini' && !geminiEnabled);
            const history = usageHistory[`${k.provider}-${k.index}`] || Array(20).fill(0);
            
            return (
              <div
                key={`${k.provider}-${k.index}`}
                className={`card-3d p-5 rounded-xl border flex flex-col gap-4 relative overflow-hidden transition-all duration-300 
                  ${isProviderDisabled ? 'opacity-40 grayscale border-zinc-200 dark:border-zinc-800' : 
                   k.provider === 'cerebras' ? 'border-orange-500 ring-2 ring-orange-500/20' : 'border-blue-500 ring-2 ring-blue-500/20'}`}
              >
                {/* 10-12s Cooldown Bar Overlay Indicator */}
                {k.status === 'COOLING_DOWN' && !isProviderDisabled && (
                  <div className="absolute top-0 left-0 h-1 bg-yellow-500 w-full opacity-50 animate-pulse"></div>
                )}
                
                {/* 60s Isolation Red Banner */}
                {k.status === 'ISOLATED' && !isProviderDisabled && (
                  <div className="absolute top-0 left-0 w-full bg-red-500 text-white text-[9px] font-bold text-center py-0.5 uppercase tracking-widest z-10">
                    ISOLATION LOCK (429)
                  </div>
                )}

                <div className="flex justify-between items-start mt-2">
                  <span className={`text-xs font-bold font-mono px-2 py-1 rounded-md border ${k.provider === 'cerebras' ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300' : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300'}`}>
                    {k.provider === 'cerebras' ? 'Cerebras' : 'Google AI'} Node {k.index}
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <D3Sparkline data={history} color={k.status === 'ISOLATED' ? '#ef4444' : k.status === 'COOLING_DOWN' ? '#eab308' : '#3b82f6'} />
                    
                    {k.status === 'READY' && <span className="text-[9px] font-bold text-green-500 bg-green-100 px-1.5 py-0.5 rounded">READY</span>}
                    {k.status === 'COOLING_DOWN' && <span className="text-[9px] font-bold text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded flex items-center gap-1"><Clock className="w-3 h-3"/> DELAY</span>}
                    {k.status === 'ISOLATED' && <span className="text-[9px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded border border-red-500 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> LOCK</span>}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5">Masked Key Identity</div>
                  <div className="font-mono text-sm truncate bg-zinc-100 dark:bg-zinc-900 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300">
                    {k.maskedKey}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-auto border-t border-zinc-200 dark:border-zinc-800 pt-3">
                  <div>
                    <div className="text-zinc-500 text-xs">Total Processed</div>
                    <div className="font-medium text-xl font-mono">{k.usageCount}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </>
      )}
      
      {activeTab === "health" && (
        <div className="card-3d rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 bg-white dark:bg-zinc-900/40">
          <div className="flex justify-between items-center mb-6 border-b border-zinc-200 dark:border-zinc-800 pb-4">
            <div>
              <h3 className="font-bold text-xl text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-500" /> System Diagnostics
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Real-time connection performance metrics.
              </p>
            </div>
            <button
              onClick={testApiHealth}
              disabled={isTestingHealth}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {isTestingHealth ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              Ping Test
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                Ping Test Result
              </h4>
              <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 min-h-[100px] flex items-center justify-center">
                {testResponse ? (
                  testResponse.error ? (
                    <div className="text-red-500 text-sm font-mono flex flex-col items-center gap-2">
                      <AlertCircle className="w-6 h-6" />
                      {testResponse.error}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 w-full">
                      <div className="flex justify-between w-full text-sm">
                        <span className="text-zinc-500">Status</span>
                        <span className="font-mono text-green-500 font-bold flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5"/> {testResponse.httpStatus} OK</span>
                      </div>
                      <div className="flex justify-between w-full text-sm">
                        <span className="text-zinc-500">Duration</span>
                        <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{testResponse.latencyMs} ms</span>
                      </div>
                      <div className="mt-2 text-[10px] text-zinc-400 font-mono text-center w-full bg-zinc-200 dark:bg-zinc-700/50 p-1 rounded overflow-hidden text-ellipsis whitespace-nowrap">
                        {JSON.stringify(testResponse.payload)}
                      </div>
                    </div>
                  )
                ) : (
                  <div className="text-zinc-400 text-sm italic">
                    Run ping test to check server connectivity
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "logs" && (
        <div className="card-3d rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900/40">
          <div className="p-5 bg-zinc-50 border-b border-zinc-200 dark:bg-zinc-900/80 dark:border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="font-bold text-lg text-zinc-900 dark:text-zinc-100">
                API Key Rotation History
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Displays 429 status changes, cooling-down periods, and key health transitions.
              </p>
            </div>
            
            <div className="flex bg-zinc-200/60 dark:bg-zinc-850 p-1 rounded-lg text-xs font-semibold">
               <span className="px-3 py-1.5 text-zinc-500 dark:text-zinc-400 italic">Hybrid logging enabled</span>
            </div>
          </div>

          <div className="p-12 text-center text-zinc-500 dark:text-zinc-400 flex flex-col items-center justify-center gap-2">
             <Clock className="w-8 h-8 text-zinc-300 dark:text-zinc-600 animate-pulse" />
             <p className="text-sm">Live rotation engine logs are running silently in the background.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ServiceMonitor;
