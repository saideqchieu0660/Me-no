import React, { useEffect, useState } from "react";
import { Key, X, AlertCircle } from "lucide-react";

export function BYOKRequiredModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [keyInput, setKeyInput] = useState("");

  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setKeyInput(localStorage.getItem("henosis_cerebras_key") || ""); // Keep same key name for backward compatibility temporarily
    };
    window.addEventListener("require-byok-key", handleOpen);
    return () => window.removeEventListener("require-byok-key", handleOpen);
  }, []);

  if (!isOpen) return null;

  const handleSave = () => {
    if (keyInput.trim()) {
      localStorage.setItem("henosis_cerebras_key", keyInput.trim());
      setIsOpen(false);
      window.location.reload(); 
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-3xl w-full max-w-lg p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
            <Key className="w-5 h-5 text-blue-500" />
            🔑 HƯỚNG DẪN LẤY API KEY GOOGLE MIỄN PHÍ (1 PHÚT)
          </h2>
          <button onClick={() => setIsOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
            <div className="text-sm text-zinc-700 dark:text-zinc-300">
              <p className="mb-3 italic">
                (🌐 Mẹo: Bạn có thể bấm chuột phải hoặc bấm dấu 3 chấm trên trình duyệt ➡️ Chọn <b>Dịch/Translate</b> để dễ đọc hơn. Tuy nhiên, một số nút bấm vẫn sẽ giữ nguyên tiếng Anh như hướng dẫn dưới đây).
              </p>
              
              <div className="space-y-3">
                <div>
                  <p className="font-bold text-blue-700 dark:text-blue-400">1️⃣ Bước 1: Đăng nhập</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>Truy cập địa chỉ: <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-600 dark:text-blue-400 hover:underline font-bold">aistudio.google.com</a></li>
                    <li>Đăng nhập bằng tài khoản <b>Gmail</b> của bạn.</li>
                    <li>Tích chọn các ô vuông đồng ý điều khoản ➡️ Bấm nút <b>Continue (Tiếp tục)</b>.</li>
                  </ul>
                </div>
                
                <div>
                  <p className="font-bold text-blue-700 dark:text-blue-400">2️⃣ Bước 2: Tạo mã nhanh</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>Chọn mục <b>Get API key</b> (Nhận khóa API - hình chiếc chìa khóa 🔑) ở menu bên cạnh.</li>
                    <li>Bấm nút màu xanh <b>Create API key</b> (Tạo khóa API).</li>
                    <li>Bấm chọn dòng đầu tiên: <b>Create API key in new project</b> (Tạo khóa API trong dự án mới).</li>
                    <li>Chờ 5 giây mã hiện ra, bấm nút <b>Copy</b> (Sao chép) để lưu lại dãy mã (mã bắt đầu bằng chữ <code className="bg-blue-100 dark:bg-blue-900/50 px-1 rounded text-blue-800 dark:text-blue-200">AIzaSy...</code>).</li>
                  </ul>
                </div>

                <div>
                  <p className="font-bold text-blue-700 dark:text-blue-400">3️⃣ Bước 3: Dán vào trang web</p>
                  <ul className="list-disc pl-5 mt-1 space-y-1">
                    <li>Quay lại trang web này.</li>
                    <li>Nhấn giữ vào ô trống (trên điện thoại) hoặc bấm chuột phải (trên máy tính) ➡️ Chọn <b>Dán (Paste)</b> ➡️ Bấm Lưu.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 italic text-center">
          * Key của bạn sẽ được <b>lưu cục bộ trên trình duyệt</b>. Lần sau bạn sẽ không cần phải lấy hoặc nhập lại nữa.
        </p>

        <div className="relative mb-6">
          <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Nhập Google API Key (ví dụ: AIzaSy...)"
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-zinc-100"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={() => setIsOpen(false)} className="px-4 py-2 rounded-xl text-zinc-500 font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition">
            Hủy
          </button>
          <button onClick={handleSave} className="px-5 py-2 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold transition shadow-lg shadow-blue-500/20">
            Lưu & Tiếp tục
          </button>
        </div>
      </div>
    </div>
  );
}
