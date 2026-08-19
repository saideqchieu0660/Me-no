import React, { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Key,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  Server,
  Activity,
  Zap,
  Cpu,
  PlayCircle,
  PauseCircle
} from "lucide-react";
import * as d3 from "d3";
import { nextGenRotationEngine, KeyStatus } from "../../services/next_gen/hybridRotationEngine";
import { nextGenIngestionEngine, IngestionState } from "../../services/next_gen/unifiedIngestionEngine";

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

    const yMax = Math.max(d3.max(data) || 0, 1) + 1;
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

export function NextGenMonitorGrid() {
  const [keys, setKeys] = useState<KeyStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [cerebrasEnabled, setCerebrasEnabled] = useState(nextGenRotationEngine.enableCerebras);
  const [geminiEnabled, setGeminiEnabled] = useState(nextGenRotationEngine.enableGemini);
  const [isUpdatingToggles, setIsUpdatingToggles] = useState(false);

  const [usageHistory, setUsageHistory] = useState<Record<string, any>>({});
  
  const [ingestionState, setIngestionState] = useState<IngestionState>({
    pendingChunks: [], processedCards: [], failedChunks: []
  });
  const [activeThreads, setActiveThreads] = useState(0);

  useEffect(() => {
    nextGenIngestionEngine.setOnStateChange((state, threads) => {
      setIngestionState(state);
      setActiveThreads(threads);
    });

    const fetchKeys = () => {
      const currentKeys = nextGenRotationEngine.getKeysStatus();
      setKeys([...currentKeys]);
      
      setUsageHistory(prev => {
        const next = { ...prev };
        currentKeys.forEach(k => {
          const id = `${k.provider}-${k.index}`;
          if (!next[id]) next[id] = Array(20).fill(0);
          
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
  }, []);

  const handleToggleChange = async (provider: 'cerebras' | 'gemini', newValue: boolean) => {
    setIsUpdatingToggles(true);

    try {
      if (newValue) {
        toast.loading(`Verifying ${provider} cluster connectivity...`, { id: 'handshake' });
        const isOk = await nextGenRotationEngine.verifyHandshake(provider);
        if (!isOk) {
          toast.error(`${provider} Cluster Unreachable - Verification Failed`, { id: 'handshake' });
          if (provider === 'cerebras') setCerebrasEnabled(false);
          if (provider === 'gemini') setGeminiEnabled(false);
          nextGenRotationEngine.setToggles(provider === 'cerebras' ? false : cerebrasEnabled, provider === 'gemini' ? false : geminiEnabled);
          setIsUpdatingToggles(false);
          return;
        }
        toast.success(`${provider} Cluster Verified & Active`, { id: 'handshake' });
      }

      if (provider === 'cerebras') setCerebrasEnabled(newValue);
      if (provider === 'gemini') setGeminiEnabled(newValue);
      
      nextGenRotationEngine.setToggles(
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

  if (isLoading) {
    return <div className="p-12 flex justify-center items-center"><Loader2 className="w-8 h-8 animate-spin text-zinc-400" /></div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 animate-in fade-in zoom-in-95 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* SCORE GAUGE */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200 flex flex-col items-center justify-center text-center">
          <div className="text-sm font-bold opacity-60 uppercase mb-2">Cluster Health</div>
          <div className="text-5xl font-display font-bold mb-2">
            <span className={healthScore >= 80 ? "text-green-500" : healthScore >= 50 ? "text-orange-500" : "text-red-500"}>
              {healthScore}%
            </span>
          </div>
          
          <div className="w-full bg-zinc-200 rounded-full h-2 mt-4 overflow-hidden flex">
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
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> {isolatedCount} FAIL</div>
          </div>
        </div>

        {/* TOGGLES */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200 lg:col-span-2 space-y-4">
          <h3 className="font-bold text-lg mb-4 border-b border-zinc-100 pb-2">Production Cluster Routing</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Cerebras */}
            <div className="flex items-center justify-between p-4 border rounded-xl border-zinc-200 bg-zinc-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold">Cerebras Llama3.1</div>
                  <div className="text-xs text-zinc-500 font-mono mt-0.5">High Speed Pipeline</div>
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
                <div className="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
              </label>
            </div>

            {/* Gemini */}
            <div className="flex items-center justify-between p-4 border rounded-xl border-zinc-200 bg-zinc-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold">Google Gemini</div>
                  <div className="text-xs text-zinc-500 font-mono mt-0.5">Context Dense Pipeline</div>
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
                <div className="w-11 h-6 bg-zinc-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>

          </div>
        </div>
      </div>

      {/* INGESTION STATUS */}
      <div className="bg-zinc-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-3xl opacity-10 -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-white/10 pb-6 mb-6">
          <div>
            <h3 className="text-2xl font-bold font-display flex items-center gap-2">
              <Server className="text-blue-400 w-6 h-6"/> Next-Gen Ingestion Queue
            </h3>
            <p className="text-zinc-400 text-sm mt-1">Strict FIFO • 10-12s Enforced Throttle • Zero Data-Loss Checkpointing</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-zinc-400 uppercase font-bold tracking-wider">Active Threads</div>
              <div className="text-2xl font-mono font-bold">{activeThreads} / 1</div>
            </div>
            <div className="w-px h-10 bg-white/10 mx-2"></div>
            {activeThreads === 0 && ingestionState.pendingChunks.length > 0 ? (
              <button onClick={() => nextGenIngestionEngine.start()} className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all">
                <PlayCircle className="w-4 h-4"/> Resume Queue
              </button>
            ) : (
              <button onClick={() => nextGenIngestionEngine.stop()} className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all text-zinc-300">
                <PauseCircle className="w-4 h-4"/> Pause
              </button>
            )}
            <button onClick={() => nextGenIngestionEngine.clearCheckpoint()} className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-xl font-bold text-sm transition-all ml-2">
              Clear Cache
            </button>
          </div>
        </div>
        
        <div className="relative z-10 grid grid-cols-3 gap-6 text-center">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-4xl font-light font-display">{ingestionState.pendingChunks.length}</div>
            <div className="text-xs text-zinc-400 uppercase tracking-widest mt-2 font-bold">Pending Chunks</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-4xl font-light font-display text-green-400">{ingestionState.processedCards.length}</div>
            <div className="text-xs text-green-400/60 uppercase tracking-widest mt-2 font-bold">Extracted Cards</div>
          </div>
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-4xl font-light font-display text-red-400">{ingestionState.failedChunks.length}</div>
            <div className="text-xs text-red-400/60 uppercase tracking-widest mt-2 font-bold">Failed Chunks</div>
          </div>
        </div>
      </div>

      {/* GRID */}
      <div className="space-y-4 pt-4">
        <h3 className="text-xl font-bold font-display flex items-center gap-2 text-zinc-800">
          <Activity className="w-5 h-5"/> Live Key Rotation Matrix
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {keys.map((k) => {
            const isProviderDisabled = (k.provider === 'cerebras' && !cerebrasEnabled) || (k.provider === 'gemini' && !geminiEnabled);
            const history = usageHistory[`${k.provider}-${k.index}`] || Array(20).fill(0);
            
            return (
              <div
                key={`${k.provider}-${k.index}`}
                className={`bg-white p-5 rounded-xl border flex flex-col gap-4 relative overflow-hidden transition-all duration-300 shadow-sm
                  ${isProviderDisabled ? 'opacity-40 grayscale border-zinc-200' : 
                   k.provider === 'cerebras' ? 'border-orange-500/30' : 'border-blue-500/30'}`}
              >
                {k.status === 'COOLING_DOWN' && !isProviderDisabled && (
                  <div className="absolute top-0 left-0 h-1 bg-yellow-500 w-full opacity-50 animate-pulse"></div>
                )}
                
                {k.status === 'ISOLATED' && !isProviderDisabled && (
                  <div className="absolute top-0 left-0 w-full bg-red-500 text-white text-[9px] font-bold text-center py-0.5 uppercase tracking-widest z-10">
                    ISOLATED / 429
                  </div>
                )}

                <div className="flex justify-between items-start mt-2">
                  <span className={`text-xs font-bold font-mono px-2 py-1 rounded-md border ${k.provider === 'cerebras' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                    {k.provider === 'cerebras' ? 'Cerebras' : 'Google AI'} Node {k.index}
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <D3Sparkline data={history} color={k.status === 'ISOLATED' ? '#ef4444' : k.status === 'COOLING_DOWN' ? '#eab308' : '#3b82f6'} />
                    
                    {k.status === 'READY' && <span className="text-[9px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded border border-green-200">READY</span>}
                    {k.status === 'COOLING_DOWN' && <span className="text-[9px] font-bold text-yellow-700 bg-yellow-100 px-1.5 py-0.5 rounded border border-yellow-200 flex items-center gap-1"><Clock className="w-3 h-3"/> COOL</span>}
                    {k.status === 'ISOLATED' && <span className="text-[9px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded border border-red-300 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> FAIL</span>}
                  </div>
                </div>

                <div>
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-0.5 font-bold">Secure Masked Token</div>
                  <div className="font-mono text-sm truncate bg-zinc-50 px-2 py-1.5 rounded border border-zinc-200 text-zinc-600 shadow-inner">
                    {k.maskedKey}
                  </div>
                </div>

                <div className="mt-auto border-t border-zinc-100 pt-3 flex justify-between items-end">
                  <div>
                    <div className="text-zinc-400 text-xs uppercase font-bold tracking-wider">Processed</div>
                    <div className="font-medium text-xl font-mono text-zinc-800">{k.usageCount}</div>
                  </div>
                  <Key className="w-5 h-5 text-zinc-300" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
