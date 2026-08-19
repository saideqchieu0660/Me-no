import React, { useState, useEffect } from "react";
import { Save, Settings, ShieldAlert, Cpu, Bot, MessageSquare, RotateCcw } from "lucide-react";
import { nextGenPromptManager, SystemPromptMatrix } from "../../services/next_gen/promptManager";
import { toast } from "sonner";

export function NextGenPromptEditor({ adminKey }: { adminKey: string }) {
  const [config, setConfig] = useState<SystemPromptMatrix | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = () => {
      setConfig(nextGenPromptManager.getConfig());
    };
    load();
    nextGenPromptManager.fetchFromDatabase().then(() => {
      load();
    });
  }, []);

  const handleSave = async () => {
    if (!config) return;
    if (nextGenPromptManager.isHydrating) {
      toast.error("Hệ thống đang tải dữ liệu, không thể lưu lúc này.");
      return;
    }
    setIsSaving(true);
    await nextGenPromptManager.saveToDatabase(config, adminKey);
    setIsSaving(false);
  };

  const handleRestoreDefaults = () => {
    if (confirm("Bạn có chắc chắn muốn khôi phục toàn bộ cấu hình hệ thống prompt về mặc định ban đầu?")) {
      const defaults = nextGenPromptManager.restoreDefaults();
      setConfig({...defaults});
      toast.success("Đã khôi phục cấu hình gốc. Vui lòng nhấn Lưu Hệ Thống để đồng bộ.");
    }
  };

  const handleChange = (key: keyof SystemPromptMatrix, value: string) => {
    setConfig(prev => prev ? { ...prev, [key]: value } : null);
  };

  if (!config) return null;

  const renderTextarea = (key: keyof SystemPromptMatrix, label: string, icon: React.ReactNode, description?: string) => (
    <div className="mb-6">
      <label className="flex items-center gap-2 font-bold text-zinc-700 mb-2">
        {icon} {label}
      </label>
      <textarea
        value={config[key]}
        onChange={(e) => handleChange(key, e.target.value)}
        className="w-full h-32 p-4 rounded-xl border border-zinc-200 bg-zinc-50 font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
        placeholder={`Nhập ${label}...`}
      />
      {description && <p className="text-xs text-zinc-500 mt-2 font-mono">{description}</p>}
    </div>
  );

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200 mt-6">
      <div className="flex items-center justify-between mb-6 border-b border-zinc-100 pb-4">
        <div>
          <h3 className="font-bold text-xl font-display flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-500" /> Quản Lý Hệ Thống Câu Lệnh AI (Dynamic Prompt Control)
          </h3>
          <p className="text-zinc-500 text-sm mt-1">Cấu hình prompt và bộ lọc từ ngữ cho Unified Ingestion Engine V2 và các Agent.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRestoreDefaults}
            disabled={isSaving}
            className="bg-zinc-100 hover:bg-zinc-200 text-zinc-700 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" /> Khôi phục cấu hình gốc
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {isSaving ? <span className="animate-pulse">Đang đồng bộ...</span> : <><Save className="w-4 h-4" /> Đồng bộ Hệ thống (Save & Sync)</>}
          </button>
        </div>
      </div>

      <div className="space-y-8">
        
        {/* Agent 2 */}
        <div className="border border-zinc-100 rounded-xl p-5 bg-zinc-50/50">
          <h4 className="font-bold text-lg mb-4 flex items-center gap-2 text-zinc-800">
            <Bot className="w-5 h-5 text-blue-500" /> Agent 2 Core Modules
          </h4>
          {renderTextarea("agent2_system_core", "System Core", <Cpu className="w-4 h-4 text-zinc-400" />)}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderTextarea("agent2_fast_mode", "Fast Mode", <Cpu className="w-4 h-4 text-zinc-400" />)}
            {renderTextarea("agent2_detailed_mode", "Detailed Mode", <Cpu className="w-4 h-4 text-zinc-400" />)}
          </div>
        </div>

        {/* Agent 3 */}
        <div className="border border-zinc-100 rounded-xl p-5 bg-zinc-50/50">
          <h4 className="font-bold text-lg mb-4 flex items-center gap-2 text-zinc-800">
            <MessageSquare className="w-5 h-5 text-green-500" /> Agent 3 Multi-Tier Config
          </h4>
          {renderTextarea("agent3_tier1_routing", "Tier 1 Routing", <Cpu className="w-4 h-4 text-zinc-400" />)}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {renderTextarea("agent3_direct_mode", "Direct Mode", <Cpu className="w-4 h-4 text-zinc-400" />)}
             {renderTextarea("agent3_debate_mode", "Debate Mode", <Cpu className="w-4 h-4 text-zinc-400" />)}
             {renderTextarea("agent3_socratic_mode", "Socratic Mode", <Cpu className="w-4 h-4 text-zinc-400" />)}
             {renderTextarea("agent3_super_detailed_mode", "Super Detailed Mode", <Cpu className="w-4 h-4 text-zinc-400" />)}
             {renderTextarea("agent3_detailed_mode_tier", "Detailed Mode Tier", <Cpu className="w-4 h-4 text-zinc-400" />)}
             {renderTextarea("agent3_concise_mode", "Concise Mode", <Cpu className="w-4 h-4 text-zinc-400" />)}
             {renderTextarea("agent3_prompt_injection_reminder", "Prompt Injection Reminder", <ShieldAlert className="w-4 h-4 text-amber-500" />)}
             {renderTextarea("agent3_socratic_rule_detailed", "Socratic Rule Detailed", <Cpu className="w-4 h-4 text-zinc-400" />)}
             {renderTextarea("agent3_socratic_rule_concise", "Socratic Rule Concise", <Cpu className="w-4 h-4 text-zinc-400" />)}
             {renderTextarea("agent3_english_rule", "English Rule", <Cpu className="w-4 h-4 text-zinc-400" />)}
          </div>
        </div>

        {/* Unified Ingestion V2 */}
        <div className="border border-zinc-100 rounded-xl p-5 bg-zinc-50/50">
          <h4 className="font-bold text-lg mb-4 flex items-center gap-2 text-zinc-800">
            <Cpu className="w-5 h-5 text-purple-500" /> Unified Ingestion Engine V2
          </h4>
          {renderTextarea("document_ingestion_normal", "Ingestion Normal", <Cpu className="w-4 h-4 text-zinc-400" />, "Lưu ý: Đoạn text gốc sẽ được nối tự động vào cuối (Text: [Nội dung]).")}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {renderTextarea("document_ingestion_degraded", "Ingestion Degraded", <Cpu className="w-4 h-4 text-zinc-400" />)}
             {renderTextarea("extract_valid_words_fallback", "Extract Valid Words Fallback", <Cpu className="w-4 h-4 text-zinc-400" />)}
             {renderTextarea("card_hydration", "Card Hydration", <Cpu className="w-4 h-4 text-zinc-400" />)}
             {renderTextarea("json_validator_repairer", "JSON Validator Repairer", <Cpu className="w-4 h-4 text-zinc-400" />)}
          </div>
        </div>
        
        {/* Safety */}
        <div className="border border-zinc-100 rounded-xl p-5 bg-zinc-50/50">
           <h4 className="font-bold text-lg mb-4 flex items-center gap-2 text-zinc-800">
             <ShieldAlert className="w-5 h-5 text-red-500" /> Security & Policy
           </h4>
           {renderTextarea("safetyDictionary", "Safety & Profanity Interceptor Dictionary", <ShieldAlert className="w-4 h-4 text-red-400" />, "Mỗi từ cấm nằm trên một dòng. Viết hoa/thường không phân biệt.")}
        </div>

      </div>
    </div>
  );
}
