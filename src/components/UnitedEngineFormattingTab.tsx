import React, { useState, useRef, useEffect } from "react";
import { store, Deck } from "../lib/store";
import { optimizeFormattingBatch } from "../formatting/formattingClient";
import { CustomDeckSelect } from "./CustomDeckSelect";
import { toast } from "sonner";
import { cn } from "../lib/utils";
import { 
  Loader2, 
  CheckCircle, 
  Save, 
  XCircle, 
  FileText, 
  FileUp, 
  Sparkles, 
  Wand2, 
  Layers, 
  Plus, 
  Trash2, 
  ArrowRight,
  RefreshCw
} from "lucide-react";
// @ts-ignore
import { VibeSyncEngine } from "../vibe-sandbox/sync/VibeSyncEngine";
import { safeRequest } from "../utils/apiClient";
import { v4 as uuidv4 } from "uuid";

const loadPdfJS = () => {
  return new Promise<any>((resolve, reject) => {
    if ((window as any).pdfjsLib) {
      resolve((window as any).pdfjsLib);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js";
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js";
      resolve(pdfjsLib);
    };
    script.onerror = () => {
      reject(new Error("Không thể tải thư viện PDF.js. Vui lòng kiểm tra kết nối mạng."));
    };
    document.head.appendChild(script);
  });
};

export function UnitedEngineFormattingTab() {
  const [engineTab, setEngineTab] = useState<"file" | "text" | "format">("file");

  // Format mode state
  const [selectedFormatDeckId, setSelectedFormatDeckId] = useState<string>("");
  const [isFormatting, setIsFormatting] = useState(false);
  const [formattedCards, setFormattedCards] = useState<{ id: string; oldFront: string; oldBack: string; newFront: string; newBack: string }[] | null>(null);

  // File & Text Mode state
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedCards, setExtractedCards] = useState<{ id: string; front: string; back: string }[]>([]);
  
  // Target deck choice for File/Text mode
  const [saveOption, setSaveOption] = useState<"new_deck" | "existing_deck" | "existing_section" | "new_section">("new_deck");
  const [deckTitle, setDeckTitle] = useState("");
  const [deckSubject, setDeckSubject] = useState("");
  const [targetDeckId, setTargetDeckId] = useState("");
  const [selectedExistingSubject, setSelectedExistingSubject] = useState("");
  const [newSectionName, setNewSectionName] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const targetDeck = sessionStorage.getItem("united_engine_target_deck");
    if (targetDeck) {
      setSelectedFormatDeckId(targetDeck);
      setEngineTab("format");
      sessionStorage.removeItem("united_engine_target_deck");
    }
  }, []);

  // Handler for File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0];
      setFile(selected);
      if (!deckTitle) {
        setDeckTitle(selected.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  // Process File / Image / PDF
  const handleProcessFile = async () => {
    if (!file) {
      toast.error("Vui lòng chọn 1 tệp tin.");
      return;
    }

    setIsProcessing(true);
    setExtractedCards([]);
    try {
      let textContent = "";

      if (file.type === "text/plain" || file.name.endsWith(".txt")) {
        const reader = new FileReader();
        textContent = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsText(file);
        });
      } else if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        toast.info("Đang giải mã PDF...");
        const pdfjsLib = await loadPdfJS();
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const tokenized = await page.getTextContent();
          const pageText = tokenized.items.map((item: any) => item.str).join(" ");
          fullText += pageText + "\n";
        }
        textContent = fullText;
      } else {
        // Fallback for image or generic file: read as text or send file name
        textContent = `Tài liệu: ${file.name}`;
      }

      if (!textContent.trim()) {
        throw new Error("Không trích xuất được văn bản từ file này.");
      }

      // Process extracted text through AI
      await processTextWithAI(textContent);
    } catch (err: any) {
      toast.error("Lỗi xử lý file: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Process Raw Text with AI
  const handleProcessRawText = async () => {
    if (!rawText.trim()) {
      toast.error("Vui lòng nhập hoặc dán văn bản thô.");
      return;
    }

    setIsProcessing(true);
    setExtractedCards([]);
    try {
      await processTextWithAI(rawText);
    } catch (err: any) {
      toast.error("Lỗi trích xuất AI: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Common AI Extraction call
  const processTextWithAI = async (textInput: string) => {
    toast.info("AI đang phân tích và tạo bộ thẻ...");
    
    // Chunking text if too long
    const CHUNK_SIZE = 2500;
    const rawChunks = textInput.match(/[\s\S]{1,2500}/g) || [textInput];
    let allCards: { id: string; front: string; back: string }[] = [];

    for (let i = 0; i < rawChunks.length; i++) {
      const res = await safeRequest("/api/ai/fix-json-structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonText: rawChunks[i] })
      });

      const data = await res.json();
      if (data && data.success && Array.isArray(data.cards)) {
        const formatted = data.cards.map((c: any) => ({
          id: uuidv4(),
          front: c.front || c.question || c.word || "",
          back: c.back || c.answer || c.definition || ""
        }));
        allCards.push(...formatted);
      }
    }

    if (allCards.length === 0) {
      toast.error("Không tìm thấy thẻ học nào từ nội dung này.");
    } else {
      setExtractedCards(allCards);
      toast.success(`Đã trích xuất thành công ${allCards.length} thẻ học!`);
    }
  };

  // Save Extracted Cards to Deck / Section
  const handleSaveExtractedCards = () => {
    if (extractedCards.length === 0) return;

    const formattedCardsForDeck = extractedCards.map(c => ({
      id: c.id || uuidv4(),
      front: c.front,
      back: c.back,
      subject: "Tổng hợp",
      mastery: 0,
      nextReview: Date.now(),
      isHard: false
    }));

    if (saveOption === "existing_deck") {
      if (!targetDeckId) {
        toast.error("Vui lòng chọn học phần cần thêm thẻ.");
        return;
      }
      const existingDeck = store.getDeck(targetDeckId);
      if (!existingDeck) {
        toast.error("Học phần được chọn không tồn tại.");
        return;
      }

      const updatedCards = [
        ...existingDeck.cards,
        ...formattedCardsForDeck.map(c => ({ ...c, subject: existingDeck.subject || "Tổng hợp" }))
      ];
      store.setDecksLocally(store.getDecks().map(d => d.id === existingDeck.id ? { ...existingDeck, cards: updatedCards } : d));
      // Save offline
      import('../utils/offlineDb').then(({ saveDeckOffline }) => {
          saveDeckOffline({ ...existingDeck, cards: updatedCards });
      });
      toast.success(`Đã thêm ${extractedCards.length} thẻ vào học phần "${existingDeck.title}"!`);
    } else if (saveOption === "new_deck") {
      const finalTitle = deckTitle.trim() || `Bộ thẻ United Engine ${new Date().toLocaleDateString("vi-VN")}`;
      const finalSubject = deckSubject.trim() || "Tổng hợp";
      const newDeck: Deck = {
        id: uuidv4(),
        title: finalTitle,
        subject: finalSubject,
        cards: formattedCardsForDeck.map(c => ({ ...c, subject: finalSubject })),
        createdAt: new Date().toISOString()
      };

      store.addDeck(newDeck);
      toast.success(`Đã tạo học phần mới "${finalTitle}" với ${extractedCards.length} thẻ!`);
    } else if (saveOption === "existing_section") {
      if (!selectedExistingSubject) {
        toast.error("Vui lòng chọn một phần mục có sẵn.");
        return;
      }
      const finalTitle = deckTitle.trim() || `Học phần mới (${new Date().toLocaleDateString("vi-VN")})`;
      const newDeck: Deck = {
        id: uuidv4(),
        title: finalTitle,
        subject: selectedExistingSubject,
        cards: formattedCardsForDeck.map(c => ({ ...c, subject: selectedExistingSubject })),
        createdAt: new Date().toISOString()
      };

      store.addDeck(newDeck);
      toast.success(`Đã thêm học phần "${finalTitle}" vào phần mục có sẵn "${selectedExistingSubject}"!`);
    } else if (saveOption === "new_section") {
      const finalSection = newSectionName.trim() || "Phần mục mới";
      const finalTitle = deckTitle.trim() || `Học phần ${finalSection}`;
      const newDeck: Deck = {
        id: uuidv4(),
        title: finalTitle,
        subject: finalSection,
        cards: formattedCardsForDeck.map(c => ({ ...c, subject: finalSection })),
        createdAt: new Date().toISOString()
      };

      store.addDeck(newDeck);
      toast.success(`Đã tạo phần mục mới "${finalSection}" chứa học phần "${finalTitle}"!`);
    }

    // Reset after save
    setExtractedCards([]);
    setFile(null);
    setRawText("");
    setDeckTitle("");
    setDeckSubject("");
    setNewSectionName("");
    setSelectedExistingSubject("");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("henosis-data-synced"));
    }
  };

  // Batch Formatting Handler
  const handleFormat = async () => {
    if (!selectedFormatDeckId) {
      toast.error("Vui lòng chọn một bộ thẻ.");
      return;
    }
    const deck = store.getDeck(selectedFormatDeckId);
    if (!deck || !deck.cards || deck.cards.length === 0) {
      toast.error("Bộ thẻ trống.");
      return;
    }

    setIsFormatting(true);
    try {
      const textsToFormat = deck.cards.map(c => c.back || "");
      const formattedTexts = await optimizeFormattingBatch(textsToFormat);
      
      const results = deck.cards.map((card, idx) => ({
        id: card.id,
        oldFront: card.front,
        oldBack: card.back,
        newFront: card.front,
        newBack: formattedTexts[idx] || card.back || "",
      }));
      
      setFormattedCards(results);
      toast.success(`Đã định dạng tối ưu xong ${deck.cards.length} thẻ.`);
    } catch (e: any) {
      toast.error("Lỗi khi định dạng AI: " + e.message);
    } finally {
      setIsFormatting(false);
    }
  };

  const handleApplyFormatting = async () => {
    if (!formattedCards || !selectedFormatDeckId) return;
    
    const deck = store.getDeck(selectedFormatDeckId);
    if (!deck) return;

    let changesCount = 0;
    formattedCards.forEach((fc) => {
      const cardRef = deck.cards.find(c => c.id === fc.id);
      if (cardRef && (cardRef.back !== fc.newBack || cardRef.front !== fc.newFront)) {
        cardRef.back = fc.newBack;
        cardRef.front = fc.newFront;
        changesCount++;
        
        const user = store.getCurrentUser();
        if (user) {
           VibeSyncEngine.enqueueChange({
               type: "UPSERT_CARD_STATE",
               payload: {
                   uid: user.id,
                   cardId: cardRef.id,
                   back: fc.newBack,
                   front: fc.newFront
               }
           }).catch(err => console.warn("Queue ignored:", err));
        }
      }
    });

    if (changesCount > 0) {
       store.setDecksLocally(store.getDecks());
       if (typeof window !== "undefined") {
           window.dispatchEvent(new CustomEvent("henosis-data-synced"));
       }
       toast.success(`Đã lưu định dạng mới cho ${changesCount} thẻ.`);
    } else {
       toast.info("Không có thay đổi nào cần lưu.");
    }
    
    setFormattedCards(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Sub-tab switcher inside United Engine */}
      <div className="grid grid-cols-3 p-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 gap-1">
        <button
          onClick={() => setEngineTab("file")}
          className={cn(
            "py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 border-none",
            engineTab === "file"
              ? "bg-white dark:bg-zinc-800 text-orange-600 dark:text-orange-400 shadow-sm"
              : "text-black dark:text-white opacity-80 hover:opacity-100"
          )}
        >
          <FileText className="w-4 h-4" /> 📁 File / Image
        </button>
        <button
          onClick={() => setEngineTab("text")}
          className={cn(
            "py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 border-none",
            engineTab === "text"
              ? "bg-white dark:bg-zinc-800 text-orange-600 dark:text-orange-400 shadow-sm"
              : "text-black dark:text-white opacity-80 hover:opacity-100"
          )}
        >
          <Sparkles className="w-4 h-4" /> ✍️ Văn Bản Thô
        </button>
        <button
          onClick={() => setEngineTab("format")}
          className={cn(
            "py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 border-none",
            engineTab === "format"
              ? "bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm"
              : "text-black dark:text-white opacity-80 hover:opacity-100"
          )}
        >
          <RefreshCw className="w-4 h-4" /> 🔄 Tối Ưu Định Dạng
        </button>
      </div>

      {/* MODE 1: FILE / IMAGE INGESTION */}
      {engineTab === "file" && (
        <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 space-y-5">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-black uppercase tracking-wider text-black dark:text-white flex items-center gap-2">
              <FileUp className="w-4 h-4 text-orange-500" /> Trích xuất dữ liệu từ File / Ảnh
            </h4>
            <span className="text-[10px] bg-orange-500/10 text-orange-600 dark:text-orange-400 font-extrabold px-2 py-0.5 rounded">
              PDF / Image / Text
            </span>
          </div>

          <div
            className={cn(
              "border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer bg-white dark:bg-zinc-900",
              file ? "border-orange-500 bg-orange-500/5" : "border-zinc-300 dark:border-zinc-800 hover:border-orange-500/50",
              isProcessing && "opacity-50 pointer-events-none"
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="application/pdf,image/*,text/plain"
            />
            {file ? (
              <div className="space-y-2">
                <FileText className="w-10 h-10 text-orange-500 mx-auto animate-bounce" />
                <p className="font-extrabold text-sm text-black dark:text-white">{file.name}</p>
                <p className="text-xs text-black dark:text-white opacity-80">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                <span className="text-[10px] bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2 py-0.5 rounded font-black inline-block mt-2">
                  Chạm để đổi file khác
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <FileUp className="w-10 h-10 text-zinc-400 mx-auto" />
                <p className="font-bold text-sm text-black dark:text-white">Nhấn hoặc Kéo thả File PDF, Ảnh, hoặc File Text vào đây</p>
                <p className="text-xs text-black dark:text-white opacity-80">United Engine sẽ tự động bóc tách từ vựng & kiến thức bằng AI</p>
              </div>
            )}
          </div>

          <button
            onClick={handleProcessFile}
            disabled={!file || isProcessing}
            className="btn-3d w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black rounded-xl cursor-pointer transition flex items-center justify-center gap-2 text-sm shadow-md"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {isProcessing ? "United Engine đang xử lý..." : "Trích xuất & Bóc tách Thẻ bằng AI"}
          </button>
        </div>
      )}

      {/* MODE 2: RAW TEXT INGESTION */}
      {engineTab === "text" && (
        <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 space-y-5">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-black uppercase tracking-wider text-black dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-500" /> Trích xuất từ Văn Bản Thô
            </h4>
            <span className="text-[10px] bg-orange-500/10 text-orange-600 dark:text-orange-400 font-extrabold px-2 py-0.5 rounded">
              AI Auto-Chunk & Structurer
            </span>
          </div>

          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            disabled={isProcessing}
            placeholder="Dán văn bản bài đọc, tài liệu học tập, hoặc danh sách từ vựng vào đây...
Ví dụ:
vibration - sự rung động
break down - phân tích, hỏng hóc...
Hoặc dán cả đoạn văn dài, AI sẽ tự lọc các khái niệm trọng tâm!"
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-250 dark:border-zinc-800 rounded-xl p-4 text-xs font-medium text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 min-h-[180px] resize-y"
          />

          <button
            onClick={handleProcessRawText}
            disabled={!rawText.trim() || isProcessing}
            className="btn-3d w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-black rounded-xl cursor-pointer transition flex items-center justify-center gap-2 text-sm shadow-md"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {isProcessing ? "United Engine đang phân tích..." : "Phân tích & Trích xuất Thẻ bằng AI"}
          </button>
        </div>
      )}

      {/* MODE 3: FORMATTING OPTIMIZER */}
      {engineTab === "format" && (
        <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 space-y-5">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-black uppercase tracking-wide text-black dark:text-white flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-500" /> Tối ưu hóa định dạng Flashcard (Line Breaks)
            </h4>
            <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold px-2 py-0.5 rounded">
              Chế độ hàng loạt
            </span>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase text-black dark:text-white block tracking-wide">
              CHỌN BỘ THẺ CẦN TỐI ƯU
            </label>
            <CustomDeckSelect
              decks={store.getDecks()}
              value={selectedFormatDeckId}
              onChange={(val) => {
                setSelectedFormatDeckId(val);
                setFormattedCards(null);
              }}
            />
          </div>
          
          {!formattedCards ? (
              <button
                onClick={handleFormat}
                disabled={isFormatting || !selectedFormatDeckId}
                className="btn-3d px-6 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-55 text-white font-black rounded-xl cursor-pointer hover:shadow transition flex items-center justify-center gap-2 text-sm w-full"
              >
                {isFormatting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {isFormatting ? "Đang phân tích..." : "Optimize Formatting"}
              </button>
          ) : (
              <div className="space-y-4">
                  <div className="max-h-96 overflow-y-auto space-y-4 pr-2">
                      {formattedCards.map((fc, i) => {
                          const isChanged = fc.oldBack !== fc.newBack || fc.oldFront !== fc.newFront;
                          return (
                              <div key={fc.id} className={cn("p-4 rounded-xl border text-sm", isChanged ? "border-blue-400 bg-blue-50 dark:bg-blue-900/10" : "border-zinc-200 dark:border-zinc-800")}>
                                  <div className="font-bold mb-2 text-black dark:text-white">Thẻ {i + 1}: {fc.oldFront}</div>
                                  <div className="grid grid-cols-2 gap-4">
                                      <div>
                                          <div className="text-xs text-black dark:text-white opacity-70 font-bold mb-1">Cũ (Raw):</div>
                                          <div className="whitespace-pre-wrap text-black dark:text-white opacity-80">{fc.oldBack}</div>
                                      </div>
                                      <div>
                                          <div className="text-xs font-bold mb-1 text-blue-600 dark:text-blue-400">Mới (Formatted):</div>
                                          <div className="whitespace-pre-wrap text-black dark:text-white">{fc.newBack}</div>
                                      </div>
                                  </div>
                              </div>
                          )
                      })}
                  </div>
                  
                  <div className="flex gap-4">
                      <button
                          onClick={handleApplyFormatting}
                          className="flex-1 btn-3d px-6 py-2.5 bg-green-500 hover:bg-green-600 text-white font-black rounded-xl cursor-pointer hover:shadow transition flex items-center justify-center gap-2 text-sm active:scale-95"
                      >
                          <Save className="w-4 h-4" /> Xác nhận lưu
                      </button>
                      <button
                          onClick={() => setFormattedCards(null)}
                          className="btn-3d px-6 py-2.5 bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white font-black rounded-xl cursor-pointer hover:shadow transition flex items-center justify-center gap-2 text-sm active:scale-95"
                      >
                          <XCircle className="w-4 h-4" /> Hủy
                      </button>
                  </div>
              </div>
          )}
        </div>
      )}

      {/* EXTRACTED CARDS PREVIEW & SAVE PANEL (For File & Text Mode) */}
      {extractedCards.length > 0 && (
        <div className="p-6 rounded-2xl border border-orange-500/30 bg-orange-500/5 space-y-5 animate-in slide-in-from-bottom-3 duration-300">
          <div className="flex justify-between items-center border-b border-orange-500/20 pb-3">
            <div>
              <h3 className="font-black text-base text-black dark:text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" /> Kết quả trích xuất ({extractedCards.length} thẻ)
              </h3>
              <p className="text-xs text-black dark:text-white opacity-80">Kiểm tra nội dung các thẻ vừa được United Engine trích xuất trước khi lưu.</p>
            </div>
            <button
              onClick={() => setExtractedCards([])}
              className="text-xs text-black dark:text-white opacity-70 hover:opacity-100 font-bold"
            >
              Làm mới / Hủy
            </button>
          </div>

          {/* Cards List Preview */}
          <div className="max-h-80 overflow-y-auto space-y-3 pr-2">
            {extractedCards.map((card, idx) => (
              <div key={card.id || idx} className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-start gap-3 text-xs shadow-sm">
                <span className="font-mono font-black text-orange-500 text-[11px] pt-0.5">#{idx + 1}</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-black dark:text-white opacity-70 block mb-0.5">Mặt trước:</span>
                    <p className="font-semibold text-black dark:text-white">{card.front}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-black dark:text-white opacity-70 block mb-0.5">Mặt sau:</span>
                    <p className="text-black dark:text-white whitespace-pre-wrap">{card.back}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Save Configuration */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-4 shadow-sm">
            <div className="space-y-1">
              <label className="text-xs font-black uppercase text-black dark:text-white tracking-wider block">
                Chọn nơi lưu trữ kết quả trích xuất:
              </label>
              <p className="text-[11px] text-black dark:text-white opacity-80">Bạn có thể chọn lưu vào học phần hoặc phần mục (môn học/thư mục) sẵn có hoặc khởi tạo mới.</p>
            </div>

            {/* 4 Save Options Selector */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setSaveOption("existing_deck")}
                className={cn(
                  "p-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer text-left flex flex-col justify-between gap-1",
                  saveOption === "existing_deck"
                    ? "border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400 shadow-sm"
                    : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850 text-black dark:text-white hover:border-orange-500/50"
                )}
              >
                <span className="text-base">📚</span>
                <span>Học phần có sẵn</span>
              </button>

              <button
                type="button"
                onClick={() => setSaveOption("new_deck")}
                className={cn(
                  "p-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer text-left flex flex-col justify-between gap-1",
                  saveOption === "new_deck"
                    ? "border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400 shadow-sm"
                    : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850 text-black dark:text-white hover:border-orange-500/50"
                )}
              >
                <span className="text-base">➕</span>
                <span>Học phần mới</span>
              </button>

              <button
                type="button"
                onClick={() => setSaveOption("existing_section")}
                className={cn(
                  "p-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer text-left flex flex-col justify-between gap-1",
                  saveOption === "existing_section"
                    ? "border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400 shadow-sm"
                    : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850 text-black dark:text-white hover:border-orange-500/50"
                )}
              >
                <span className="text-base">📁</span>
                <span>Phần mục có sẵn</span>
              </button>

              <button
                type="button"
                onClick={() => setSaveOption("new_section")}
                className={cn(
                  "p-2.5 rounded-xl border text-xs font-black transition-all cursor-pointer text-left flex flex-col justify-between gap-1",
                  saveOption === "new_section"
                    ? "border-orange-500 bg-orange-500/10 text-orange-600 dark:text-orange-400 shadow-sm"
                    : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850 text-black dark:text-white hover:border-orange-500/50"
                )}
              >
                <span className="text-base">📂</span>
                <span>Phần mục mới</span>
              </button>
            </div>

            {/* Form inputs based on option */}
            {saveOption === "existing_deck" && (
              <div className="space-y-2 pt-1 animate-in fade-in duration-150">
                <label className="text-[10px] font-black uppercase tracking-wider text-black dark:text-white block">Chọn Học phần có sẵn để chèn thẻ vào</label>
                <CustomDeckSelect
                  decks={store.getDecks()}
                  value={targetDeckId}
                  onChange={setTargetDeckId}
                />
              </div>
            )}

            {saveOption === "new_deck" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 animate-in fade-in duration-150">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-black dark:text-white block mb-1">Tên học phần mới</label>
                  <input
                    type="text"
                    value={deckTitle}
                    onChange={(e) => setDeckTitle(e.target.value)}
                    placeholder="VD: Từ vựng IELTS Listening"
                    className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850 text-black dark:text-white focus:ring-2 focus:ring-orange-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-black dark:text-white block mb-1">Phần mục / Subject</label>
                  <input
                    type="text"
                    value={deckSubject}
                    onChange={(e) => setDeckSubject(e.target.value)}
                    placeholder="VD: Tiếng Anh"
                    className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850 text-black dark:text-white focus:ring-2 focus:ring-orange-500/50 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {saveOption === "existing_section" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 animate-in fade-in duration-150">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-black dark:text-white block mb-1">Chọn phần mục (chủ đề) có sẵn</label>
                  <select
                    value={selectedExistingSubject}
                    onChange={(e) => setSelectedExistingSubject(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850 text-black dark:text-white focus:ring-2 focus:ring-orange-500/50 focus:outline-none"
                  >
                    <option value="">-- Chọn phần mục --</option>
                    {Array.from(new Set(store.getDecks().map(d => d.subject).filter(Boolean))).map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-black dark:text-white block mb-1">Tên học phần mới thuộc phần mục này</label>
                  <input
                    type="text"
                    value={deckTitle}
                    onChange={(e) => setDeckTitle(e.target.value)}
                    placeholder="VD: Chương 1 - Khái niệm"
                    className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850 text-black dark:text-white focus:ring-2 focus:ring-orange-500/50 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {saveOption === "new_section" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 animate-in fade-in duration-150">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-black dark:text-white block mb-1">Tên phần mục mới</label>
                  <input
                    type="text"
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    placeholder="VD: Triết học Mác-Lênin"
                    className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850 text-black dark:text-white focus:ring-2 focus:ring-orange-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-black dark:text-white block mb-1">Tên học phần đầu tiên trong phần mục này</label>
                  <input
                    type="text"
                    value={deckTitle}
                    onChange={(e) => setDeckTitle(e.target.value)}
                    placeholder="VD: Bài 1: Chủ nghĩa duy vật"
                    className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-850 text-black dark:text-white focus:ring-2 focus:ring-orange-500/50 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleSaveExtractedCards}
              className="btn-3d w-full py-3 bg-green-500 hover:bg-green-600 text-white font-black rounded-xl cursor-pointer transition flex items-center justify-center gap-2 text-sm shadow-md mt-2"
            >
              <Save className="w-4 h-4" /> Lưu Kết Quả Ngay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
