import React, { useState } from "react";
import { store, Deck } from "../lib/store";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import { Plus, Trash2, Save, Layers, Sparkles, Code2, PenTool, Wand2, Loader2 } from "lucide-react";
import { CustomDeckSelect } from "../components/CustomDeckSelect";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { safeRequest } from "../utils/apiClient";

export function VibeManualFlashcardPipeline() {
  const [inputType, setInputType] = useState<"manual" | "json">("manual");
  const [jsonInput, setJsonInput] = useState("");
  const [isAIFixing, setIsAIFixing] = useState(false);
  const [aiProgress, setAiProgress] = useState({ current: 0, total: 1, percent: 0 });
  
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [cards, setCards] = useState<{ id: string; front: string; back: string }[]>([
    { id: uuidv4(), front: "", back: "" }
  ]);
  
  const [saveMode, setSaveMode] = useState<"new" | "existing">("new");
  const [selectedDeckId, setSelectedDeckId] = useState("");

  const handleAddCard = () => {
    setCards([...cards, { id: uuidv4(), front: "", back: "" }]);
  };

  const handleRemoveCard = (id: string) => {
    if (cards.length > 1) {
      setCards(cards.filter(c => c.id !== id));
    }
  };

  const handleChangeCard = (id: string, field: "front" | "back", value: string) => {
    setCards(cards.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const handleAIFix = async () => {
    if (!jsonInput.trim()) {
      toast.error("Vui lòng nhập JSON hoặc văn bản thô để AI xử lý.");
      return;
    }

    setIsAIFixing(true);
    setAiProgress({ current: 0, total: 1, percent: 0 });

    try {
      let chunks: string[] = [];
      let finalTitle = "";
      let finalSubject = "";
      
      try {
        const parsed = JSON.parse(jsonInput);
        let cardsArray: any[] = [];
        
        if (Array.isArray(parsed)) {
          cardsArray = parsed;
        } else if (parsed && typeof parsed === "object") {
          cardsArray = parsed.cards || [];
          finalTitle = parsed.title || "";
          finalSubject = parsed.subject || "";
        }

        if (cardsArray.length > 0) {
          const CHUNK_SIZE = 50;
          for (let i = 0; i < cardsArray.length; i += CHUNK_SIZE) {
             chunks.push(JSON.stringify(cardsArray.slice(i, i + CHUNK_SIZE)));
          }
        } else {
          chunks = [jsonInput]; 
        }
      } catch (e) {
         // Raw text fallback: split by roughly 2500 characters
         const rawChunks = jsonInput.match(/[\s\S]{1,2500}/g) || [];
         chunks = rawChunks;
      }

      let allFixedCards: any[] = [];
      setAiProgress({ current: 0, total: chunks.length, percent: 0 });

      for (let i = 0; i < chunks.length; i++) {
         const res = await safeRequest("/api/ai/fix-json-structure", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ jsonText: chunks[i] })
         });
         
         const data = await res.json();
         if (data && data.success && Array.isArray(data.cards)) {
            allFixedCards.push(...data.cards);
         }
         
         setAiProgress({ current: i + 1, total: chunks.length, percent: Math.round(((i + 1) / chunks.length) * 100) });
      }

      const finalResult = {
        title: finalTitle,
        subject: finalSubject,
        cards: allFixedCards
      };

      setJsonInput(JSON.stringify(finalResult, null, 2));
      toast.success("AI đã hoàn tất việc sửa định dạng JSON!");
    } catch (error: any) {
      toast.error("Lỗi khi dùng AI sửa JSON: " + error.message);
    } finally {
      setIsAIFixing(false);
    }
  };

  const handleSave = async () => {
    let outputJSON: any = null;

    if (inputType === "manual") {
      if (saveMode === "new" && (!title.trim() || !subject.trim())) {
        toast.error("Vui lòng nhập Tiêu đề và Danh mục cho bộ thẻ mới.");
        return;
      }
      if (saveMode === "existing" && !selectedDeckId) {
        toast.error("Vui lòng chọn bộ thẻ có sẵn.");
        return;
      }
      
      const validCards = cards.filter(c => c.front.trim() || c.back.trim());
      if (validCards.length === 0) {
        toast.error("Vui lòng nhập ít nhất một thẻ.");
        return;
      }

      outputJSON = {
        title: saveMode === "new" ? title.trim() : "", 
        subject: saveMode === "new" ? subject.trim() : "",
        cards: validCards.map(c => ({
           front: c.front.trim(),
           back: c.back.trim()
        }))
      };
    } else {
      // JSON Input Mode
      if (!jsonInput.trim()) {
        toast.error("Vui lòng nhập chuỗi JSON.");
        return;
      }
      try {
        const parsed = JSON.parse(jsonInput);
        if (!parsed.cards || !Array.isArray(parsed.cards)) {
           throw new Error("JSON thiếu mảng 'cards'.");
        }
        
        if (saveMode === "new" && (!parsed.title || !parsed.subject)) {
           throw new Error("JSON tạo bộ thẻ mới phải có 'title' và 'subject'.");
        }
        
        if (saveMode === "existing" && !selectedDeckId) {
          toast.error("Vui lòng chọn bộ thẻ có sẵn.");
          return;
        }

        outputJSON = {
          title: saveMode === "new" ? parsed.title : "",
          subject: saveMode === "new" ? parsed.subject : "",
          cards: parsed.cards.map((c: any) => ({
             front: String(c.front || "").trim(),
             back: String(c.back || "").trim()
          }))
        };
        
        const validCards = outputJSON.cards.filter((c: any) => c.front || c.back);
        if (validCards.length === 0) {
           throw new Error("Không có thẻ nào hợp lệ trong JSON.");
        }
        outputJSON.cards = validCards;
        
      } catch (err: any) {
        toast.error("Lỗi parse JSON: " + err.message);
        return;
      }
    }

    try {
      if (saveMode === "new") {
        const newDeck: Deck = {
          id: uuidv4(),
          title: outputJSON.title,
          subject: outputJSON.subject,
          cards: outputJSON.cards.map((c: any) => ({
            id: uuidv4(),
            front: c.front,
            back: c.back,
            level: 0,
            nextReview: Date.now(),
            xp: 0
          }))
        };
        await store.addDeck(newDeck);
        toast.success(`Đã tạo bộ thẻ mới: ${newDeck.title}`);
      } else {
        const allDecks = store.getDecks();
        const deckIndex = allDecks.findIndex(d => d.id === selectedDeckId);
        if (deckIndex === -1) {
          toast.error("Không tìm thấy bộ thẻ đã chọn.");
          return;
        }
        
        const newFlashcards = outputJSON.cards.map((c: any) => ({
            id: uuidv4(),
            front: c.front,
            back: c.back,
            level: 0,
            nextReview: Date.now(),
            xp: 0
        }));
        
        allDecks[deckIndex].cards.push(...newFlashcards);
        store.setDecksLocally(allDecks);
        toast.success(`Đã thêm ${newFlashcards.length} thẻ vào bộ thẻ hiện tại.`);
      }
      
      if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("henosis-data-synced"));
      }
      
      if (inputType === "manual") {
        setCards([{ id: uuidv4(), front: "", back: "" }]);
        if (saveMode === "new") {
           setTitle("");
           setSubject("");
        }
      } else {
        setJsonInput("");
      }
    } catch (error: any) {
      toast.error("Lỗi khi lưu thẻ: " + error.message);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-xs font-black uppercase text-black dark:text-white block tracking-wide">
          Biên soạn thủ công (Manual Flashcard Pipeline)
        </h4>
        <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> United Engine Standard
        </span>
      </div>

      <div className="p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 justify-between mb-8">
          <div className="flex gap-2 p-1.5 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl w-max">
            <button
              onClick={() => setInputType("manual")}
              className={cn("px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2", inputType === "manual" ? "bg-white dark:bg-zinc-700 shadow-sm text-black dark:text-white" : "text-black dark:text-white opacity-70 hover:opacity-100")}
            >
              <PenTool className="w-4 h-4" /> Điền Form
            </button>
            <button
              onClick={() => setInputType("json")}
              className={cn("px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2", inputType === "json" ? "bg-white dark:bg-zinc-700 shadow-sm text-black dark:text-white" : "text-black dark:text-white opacity-70 hover:opacity-100")}
            >
              <Code2 className="w-4 h-4" /> Nhập JSON
            </button>
          </div>
          
          <div className="flex gap-2 p-1.5 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl w-max">
            <button
              onClick={() => setSaveMode("new")}
              className={cn("px-4 py-2 rounded-xl text-sm font-bold transition-all", saveMode === "new" ? "bg-white dark:bg-zinc-700 shadow-sm text-black dark:text-white" : "text-black dark:text-white opacity-70 hover:opacity-100")}
            >
              Tạo Học phần Mới
            </button>
            <button
              onClick={() => setSaveMode("existing")}
              className={cn("px-4 py-2 rounded-xl text-sm font-bold transition-all", saveMode === "existing" ? "bg-white dark:bg-zinc-700 shadow-sm text-black dark:text-white" : "text-black dark:text-white opacity-70 hover:opacity-100")}
            >
              Lưu vào Học phần Có sẵn
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {inputType === "manual" && saveMode === "new" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase text-black dark:text-white block mb-2">Tiêu đề học phần</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: Từ vựng IELTS Unit 1"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-black dark:text-white rounded-2xl px-4 py-3 outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-black dark:text-white block mb-2">Danh mục (Subject)</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="VD: Tiếng Anh"
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-black dark:text-white rounded-2xl px-4 py-3 outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
            </div>
          )}
          
          {saveMode === "existing" && (
            <div>
              <label className="text-xs font-bold uppercase text-black dark:text-white block mb-2">Chọn bộ thẻ đích</label>
              <CustomDeckSelect
                decks={store.getDecks()}
                value={selectedDeckId}
                onChange={setSelectedDeckId}
              />
            </div>
          )}

          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
            {inputType === "manual" ? (
              <>
                <label className="text-xs font-bold uppercase text-black dark:text-white block mb-4">Danh sách Flashcard</label>
                <div className="space-y-4">
                  <AnimatePresence>
                    {cards.map((card, index) => (
                      <motion.div
                        key={card.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex gap-4 items-start"
                      >
                        <div className="flex-1 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 group hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-xs font-black text-zinc-400">THẺ SỐ {index + 1}</span>
                            {cards.length > 1 && (
                              <button
                                onClick={() => handleRemoveCard(card.id)}
                                className="text-red-500/50 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 p-1.5 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <textarea
                              placeholder="Mặt trước (Câu hỏi)..."
                              value={card.front}
                              onChange={(e) => handleChangeCard(card.id, "front", e.target.value)}
                              rows={3}
                              className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition-colors resize-none"
                            />
                            <textarea
                              placeholder="Mặt sau (Câu trả lời)..."
                              value={card.back}
                              onChange={(e) => handleChangeCard(card.id, "back", e.target.value)}
                              rows={3}
                              className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition-colors resize-none"
                            />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                
                <div className="mt-4 flex gap-4">
                  <button
                    onClick={handleAddCard}
                    className="btn-3d px-6 py-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-bold rounded-2xl flex items-center justify-center gap-2 text-sm transition-all flex-1"
                  >
                    <Plus className="w-4 h-4" /> Thêm thẻ
                  </button>
                  <button
                    onClick={handleSave}
                    className="btn-3d px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 text-sm transition-all flex-[2] shadow-lg shadow-emerald-500/20"
                  >
                    <Save className="w-4 h-4" /> Lưu và Khởi tạo
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <label className="text-xs font-bold uppercase opacity-70 flex items-center gap-2">
                    Mã Nguồn JSON <Code2 className="w-4 h-4 text-emerald-500" />
                  </label>
                  <button
                    onClick={handleAIFix}
                    disabled={isAIFixing || !jsonInput.trim()}
                    className="btn-3d px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold rounded-xl flex items-center gap-2 text-xs transition-all shadow-md shadow-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAIFixing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="w-3.5 h-3.5" />
                    )}
                    Magic Auto-Fix JSON (AI)
                  </button>
                </div>
                
                {isAIFixing && (
                  <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-500/30 rounded-xl p-3 flex flex-col gap-2">
                    <div className="flex justify-between items-center text-xs font-medium text-orange-700 dark:text-orange-400">
                      <span className="flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Đang phân tích cấu trúc... ({aiProgress.current}/{aiProgress.total} block)
                      </span>
                      <span>{aiProgress.percent}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-orange-200 dark:bg-orange-950 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-orange-500 dark:bg-orange-400 transition-all duration-300"
                        style={{ width: `${aiProgress.percent}%` }}
                      />
                    </div>
                  </div>
                )}
                
                <textarea
                  placeholder="Dán JSON schema chuẩn vào đây..."
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  disabled={isAIFixing}
                  rows={15}
                  className="w-full bg-zinc-950 text-emerald-400 font-mono text-sm border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 outline-none focus:border-emerald-500 transition-colors resize-y leading-relaxed disabled:opacity-75"
                />
                <div className="mt-4 flex gap-4">
                  <button
                    onClick={handleSave}
                    disabled={isAIFixing}
                    className="btn-3d w-full px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl flex items-center justify-center gap-2 text-sm transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4" /> Import từ JSON
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

