import React, { useState, useEffect } from "react";
import { Save, AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";

export const SystemLinksEditorWidget = () => {
  const [links, setLinks] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const adminKey = localStorage.getItem("henosis_admin_key") || "";

  const fetchLinks = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/config/system-links");
      const data = await res.json();
      if (data.success) {
        setLinks(data.data);
      } else {
        setError(data.error || "Failed to fetch");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const handleSave = async () => {
    if (!adminKey) {
      setError("Thiếu Admin Key");
      return;
    }
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/config/system-links", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-key": adminKey
        },
        body: JSON.stringify(links)
      });
      const data = await res.json();
      if (data.success) {
        setSuccess("Đã lưu thành công");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.error || "Lưu thất bại");
      }
    } catch (err: any) {
      setError(err.message || "Lưu thất bại");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-4 border rounded-xl animate-pulse">Loading links...</div>;
  }

  return (
    <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-orange-500" /> Cấu hình Liên Kết Hệ Thống (Fallback)
        </h3>
        <button onClick={fetchLinks} className="text-zinc-400 hover:text-zinc-600 cursor-pointer">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && <div className="text-red-500 text-xs bg-red-100 dark:bg-red-900/30 p-2 rounded-lg">{error}</div>}
      {success && <div className="text-emerald-500 text-xs bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded-lg flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> {success}</div>}

      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold">AI Studio Link</label>
          <input
            type="text"
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-xl text-xs font-mono"
            value={links?.aiStudioLink || ""}
            onChange={(e) => setLinks({ ...links, aiStudioLink: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold">Gemini Link</label>
          <input
            type="text"
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-xl text-xs font-mono"
            value={links?.geminiLink || ""}
            onChange={(e) => setLinks({ ...links, geminiLink: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold">Chatbot Link</label>
          <input
            type="text"
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-xl text-xs font-mono"
            value={links?.chatbotLink || ""}
            onChange={(e) => setLinks({ ...links, chatbotLink: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold">Chatbot Description</label>
          <textarea
            className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-2.5 rounded-xl text-xs font-mono"
            rows={2}
            value={links?.chatbotDescription || ""}
            onChange={(e) => setLinks({ ...links, chatbotDescription: e.target.value })}
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="mt-4 px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-xs font-bold w-full disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer transition-transform hover:scale-[1.02]"
      >
        <Save className="w-4 h-4" /> {isSaving ? "Đang lưu..." : "Lưu Cấu Hình Links"}
      </button>
    </div>
  );
};
