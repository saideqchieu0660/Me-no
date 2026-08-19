import React, { useState } from "react";
import { RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";
import { forceMergeRescue } from "../sync/VibeSyncRescue";

export const VibeRescueButton = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [log, setLog] = useState("");

  const handleRescue = async () => {
    if (!window.confirm("Thao tác này sẽ gộp toàn bộ dữ liệu học tập trên máy này với Cloud (Ghi đè bằng dữ liệu mới nhất). Bạn có chắc chắn?")) {
      return;
    }
    setLoading(true);
    setStatus("idle");
    try {
      const resultLog = await forceMergeRescue();
      setLog(resultLog);
      setStatus("success");
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      setStatus("error");
      setLog(err.message || "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end space-y-2">
      {log && (
        <div className="bg-gray-900/90 text-xs text-green-400 p-3 rounded-lg shadow-xl max-w-xs whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
          {log}
        </div>
      )}
      <button
        onClick={handleRescue}
        disabled={loading}
        className="flex items-center space-x-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-full shadow-lg transition-all"
      >
        {loading ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : status === "success" ? (
          <CheckCircle className="w-4 h-4 text-green-300" />
        ) : status === "error" ? (
          <AlertTriangle className="w-4 h-4 text-red-300" />
        ) : (
          <RefreshCw className="w-4 h-4" />
        )}
        <span className="font-semibold text-sm">
          {loading ? "Đang đồng bộ..." : "Force Sync (Cứu Hộ)"}
        </span>
      </button>
    </div>
  );
};
