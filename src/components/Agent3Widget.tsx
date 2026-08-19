import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { store } from "../lib/store";
import { toast } from "sonner";
import { 
  Bot, X, Maximize2, Minimize2, Settings, Plus, Download, FileCode, Sparkles, 
  Send, Brain, LayoutTemplate, MessageSquare, Zap, Trash2
} from "lucide-react";
import { cn } from "../lib/utils";
import { safeRequest } from "../utils/apiClient";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { useAICooldown } from "../lib/cooldown";
import { db, auth } from "../lib/firebase";
import { collection, onSnapshot, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import { motion, AnimatePresence } from "motion/react";

// --- Tách riêng component hiển thị Sơ đồ tư duy (Generative UI) ---
const GenerativeMindmap = ({ code, onAddCard }: { code: string, onAddCard: (label: string) => void }) => {
  const [activeTab, setActiveTab] = useState<"interactive" | "image" | "code">("interactive");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!code) return;
    try {
      const encoded = btoa(unescape(encodeURIComponent(code)));
      setImageUrl(`https://mermaid.ink/svg/${encoded}`);
      setImageError(false);
    } catch (e) {
      console.error("Lỗi mã hóa mermaid", e);
    }
  }, [code]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const parsedRoot = useMemo(() => {
    try {
      const lines = code.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("%%"));
      if (!lines[0]?.startsWith("mindmap")) return null;
      let rootNode: any = null;
      const stack: { node: any; level: number }[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = code.split("\n")[i]; 
        const indentStr = line.match(/^\s*/)?.[0] || "";
        const level = indentStr.length;
        const text = line.trim();
        
        const match = text.match(/^([\w\d_]+)(?:\["([^"]+)"\]|\(([^)]+)\)|\(\[([^\]]+)\]\)|\{([^}]+)\})?/);
        if (!match) continue;
        
        let label = match[2] || match[3] || match[4] || match[5] || match[1];
        let shape = "default";
        if (match[2]) shape = "square";
        else if (match[3]) shape = "rounded";
        else if (match[4]) shape = "circle";
        else if (match[5]) shape = "rhombus";

        const node = { id: match[1], label, shape, children: [] };

        if (!rootNode) {
          rootNode = node;
          stack.push({ node, level });
          continue;
        }

        while (stack.length > 0 && stack[stack.length - 1].level >= level) {
          stack.pop();
        }

        if (stack.length > 0) {
          stack[stack.length - 1].node.children.push(node);
        }
        stack.push({ node, level });
      }
      return rootNode;
    } catch(e) {
      return null;
    }
  }, [code]);

  const renderInteractiveNode = (node: any, index: number, depth: number) => {
    const hasChildren = node.children && node.children.length > 0;
    const shapeClasses = cn(
      "px-3 py-1.5 text-sm font-bold transition-all shadow-sm rounded-xl cursor-pointer flex items-center justify-between border select-none max-w-xs sm:max-w-md",
      node.shape === "circle" 
        ? "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/35 hover:bg-orange-500/25 active:scale-95"
        : node.shape === "square"
        ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700/80 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 active:scale-95"
        : "bg-orange-500/5 text-orange-800 dark:text-orange-300 border-orange-500/20 hover:bg-orange-500/10 active:scale-95"
    );

    return (
      <div key={`${node.id || "node"}-${index}-${depth}`} className="flex flex-col items-start pl-6 border-l-2 border-zinc-200 dark:border-zinc-800 my-2 py-1 relative w-full">
        <div className="absolute left-0 top-[1.2rem] w-4 border-t-2 border-zinc-200 dark:border-zinc-800" />
        
        <div className="flex items-center gap-2 relative z-10 max-w-full group/node">
          <div className={shapeClasses} onClick={() => onAddCard(node.label)}>
            <span className="truncate">{node.label}</span>
          </div>
          
          <button
            onClick={() => onAddCard(node.label)}
            className="w-6 h-6 rounded-full bg-zinc-200/80 hover:bg-orange-500 dark:bg-zinc-800 dark:hover:bg-orange-500 hover:text-black text-zinc-500 dark:text-zinc-400 flex items-center justify-center transition-all cursor-pointer shrink-0 opacity-0 group-hover/node:opacity-100"
            title="Tạo flashcard"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {hasChildren && (
          <div className="mt-2 space-y-2 w-full">
            {node.children.map((child: any, idx: number) => renderInteractiveNode(child, idx, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="my-4 border border-zinc-200/60 dark:border-zinc-800/80 rounded-2xl overflow-hidden bg-white/40 dark:bg-zinc-950/20 shadow-md relative w-full">
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-zinc-100/50 dark:bg-zinc-900/30 border-b border-zinc-200/50 dark:border-zinc-800 relative z-20">
        <span className="text-xs font-black tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-orange-500 shrink-0" />
          SƠ ĐỒ TƯ DUY AI
        </span>
        
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-1 border-r border-zinc-300 dark:border-zinc-700 pr-2">
            {imageUrl && !imageError && (
              <button 
                onClick={() => window.open(imageUrl, '_blank')}
                className="hover:bg-zinc-200 dark:hover:bg-zinc-800 p-1.5 rounded transition-colors text-zinc-500 dark:text-zinc-400 cursor-pointer"
                title="Tải ảnh"
              ><Download className="w-4 h-4" /></button>
            )}
            <button 
              onClick={handleCopy}
              className="hover:bg-zinc-200 dark:hover:bg-zinc-800 p-1.5 rounded transition-colors text-zinc-500 dark:text-zinc-400 cursor-pointer"
              title="Tải mã"
            ><FileCode className="w-4 h-4" /></button>
          </div>
          
          <div className="flex bg-zinc-200/50 dark:bg-zinc-800/80 p-0.5 rounded-lg shrink-0">
            {parsedRoot && (
              <button
                onClick={() => setActiveTab("interactive")}
                className={cn("px-2.5 py-1 text-xs font-bold rounded-md transition-all", activeTab === "interactive" ? "bg-white dark:bg-zinc-900 shadow text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400")}
              >Phân rã</button>
            )}
            {imageUrl && !imageError && (
              <button
                onClick={() => setActiveTab("image")}
                className={cn("px-2.5 py-1 text-xs font-bold rounded-md transition-all", activeTab === "image" ? "bg-white dark:bg-zinc-900 shadow text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400")}
              >Sơ đồ</button>
            )}
            <button
              onClick={() => setActiveTab("code")}
              className={cn("px-2.5 py-1 text-xs font-bold rounded-md transition-all", activeTab === "code" ? "bg-white dark:bg-zinc-900 shadow text-zinc-900 dark:text-white" : "text-zinc-500 dark:text-zinc-400")}
            >Mã</button>
          </div>
        </div>
      </div>

      <div className="p-4 overflow-x-auto min-h-[100px] flex items-center justify-start max-w-full">
        {activeTab === "interactive" && parsedRoot && (
          <div className="w-full text-left scale-95 sm:scale-100 origin-left max-w-full">
            {renderInteractiveNode(parsedRoot, 0, 0)}
          </div>
        )}
        {activeTab === "image" && imageUrl && !imageError && (
          <div className="w-full flex items-center justify-center p-2 min-h-[150px] bg-white rounded-lg">
            <img src={imageUrl} alt="Mindmap" className="max-h-[400px] object-contain" onError={() => { setImageError(true); setActiveTab("code"); }} referrerPolicy="no-referrer" />
          </div>
        )}
        {activeTab === "code" && (
          <div className="w-full text-left relative">
            <pre className="font-mono text-xs text-zinc-700 dark:text-zinc-300 overflow-x-auto p-4 bg-zinc-100 dark:bg-zinc-900/60 rounded-xl whitespace-pre-wrap">{code}</pre>
          </div>
        )}
      </div>
    </div>
  );
};


const GenerativeFlashcard = ({ front, back, onSave }: { front: string, back: string, onSave: () => void }) => {
  return (
    <div className="my-3 flex items-center justify-between p-3.5 bg-gradient-to-br from-orange-500/5 to-amber-500/5 dark:from-orange-500/10 dark:to-amber-500/10 border border-orange-200 dark:border-orange-500/20 rounded-2xl shadow-sm group">
      <div className="flex-1 pr-4">
        <div className="text-xs font-black tracking-wider text-orange-600 dark:text-orange-400 mb-1 flex items-center gap-1.5 uppercase">
          <Zap className="w-3.5 h-3.5" /> Thẻ gợi ý
        </div>
        <div className="font-bold text-zinc-900 dark:text-zinc-100 text-[15px] mb-1">{front}</div>
        <div className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">{back}</div>
      </div>
      <button 
        onClick={onSave}
        className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm flex items-center justify-center hover:scale-105 hover:bg-orange-500 hover:text-white dark:hover:bg-orange-500 dark:hover:border-orange-500 transition-all text-zinc-400 cursor-pointer shrink-0"
        title="Lưu vào bộ thẻ"
      >
        <Plus className="w-5 h-5" />
      </button>
    </div>
  );
};


const GenerativeQuiz = ({ data }: { data: any[] }) => {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResult, setShowResult] = useState<Record<number, boolean>>({});

  const handleSelect = (qIdx: number, optIdx: number) => {
    if (showResult[qIdx]) return;
    setAnswers(prev => ({ ...prev, [qIdx]: optIdx }));
  };

  const handleSubmit = (qIdx: number) => {
    if (answers[qIdx] === undefined) return;
    setShowResult(prev => ({ ...prev, [qIdx]: true }));
  };

  if (!Array.isArray(data)) return <div className="text-red-500 text-xs">Lỗi định dạng Quiz</div>;

  return (
    <div className="space-y-4 my-4 w-full">
      <div className="text-xs font-black tracking-wider text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1.5 uppercase">
        <Sparkles className="w-4 h-4" /> BÀI TẬP TRẮC NGHIỆM
      </div>
      {data.map((q, qIdx) => {
        const isRevealed = showResult[qIdx];
        return (
          <div key={qIdx} className="bg-white/60 dark:bg-zinc-950/40 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-4 shadow-sm w-full">
            <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-[15px] mb-3">{q.q}</h4>
            <div className="space-y-2">
              {q.options?.map((opt: string, optIdx: number) => {
                const isSelected = answers[qIdx] === optIdx;
                const isCorrect = q.correct === optIdx;
                
                let btnClass = "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20";
                
                if (isRevealed) {
                  if (isCorrect) {
                    btnClass = "border-emerald-500 bg-emerald-50 text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/20 dark:text-emerald-300 ring-1 ring-emerald-500/50";
                  } else if (isSelected) {
                    btnClass = "border-red-500 bg-red-50 text-red-800 dark:border-red-500/50 dark:bg-red-500/20 dark:text-red-300 ring-1 ring-red-500/50";
                  } else {
                    btnClass = "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-zinc-400 dark:text-zinc-500 opacity-50";
                  }
                } else if (isSelected) {
                  btnClass = "border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-500/50 dark:bg-blue-500/20 dark:text-blue-300 ring-1 ring-blue-500";
                }

                return (
                  <button
                    key={optIdx}
                    onClick={() => handleSelect(qIdx, optIdx)}
                    disabled={isRevealed}
                    className={cn("w-full text-left px-4 py-3 rounded-xl border transition-all text-sm font-medium flex items-start gap-3", btnClass)}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center shrink-0 border text-xs font-bold mt-0.5",
                      isRevealed && isCorrect ? "bg-emerald-500 border-emerald-500 text-white" :
                      isRevealed && isSelected && !isCorrect ? "bg-red-500 border-red-500 text-white" :
                      isSelected ? "bg-blue-500 border-blue-500 text-white" :
                      "border-zinc-300 dark:border-zinc-600 bg-transparent text-zinc-500"
                    )}>
                      {String.fromCharCode(65 + optIdx)}
                    </div>
                    <span className="leading-relaxed">{opt}</span>
                  </button>
                );
              })}
            </div>
            
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              {!isRevealed ? (
                <button 
                  onClick={() => handleSubmit(qIdx)}
                  disabled={answers[qIdx] === undefined}
                  className="px-5 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-bold rounded-xl hover:bg-zinc-800 dark:hover:bg-zinc-100 disabled:opacity-50 transition-all self-start"
                >
                  Kiểm tra đáp án
                </button>
              ) : (
                <div className="p-3.5 bg-blue-50/80 dark:bg-blue-900/20 text-blue-900 dark:text-blue-200 text-sm rounded-xl border border-blue-200/50 dark:border-blue-800/30 w-full animate-in fade-in slide-in-from-top-2">
                  <span className="font-bold flex items-center gap-1.5 mb-1.5"><Bot className="w-4 h-4"/> Giải thích:</span>
                  <span className="leading-relaxed">{q.explanation}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default function Agent3Widget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isOmnibarMode, setIsOmnibarMode] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);
  const [messages, setMessages] = useState<{role: "user"|"ai", text: string}[]>([]);
  
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() => uuidv4());
  
  const user = store.getCurrentUser();
  const { cooldownRemaining, startCooldown } = useAICooldown(user);
  const [showSettings, setShowSettings] = useState(false);
  const [highlightedContext, setHighlightedContext] = useState("");
  
  const [responseMode, setResponseMode] = useState<"socratic" | "direct" | "debate" | "auto">(() => {
    return (localStorage.getItem("agent3_response_mode") as any) || "socratic";
  });
  const [responseLength, setResponseLength] = useState<"concise" | "detailed" | "super_detailed">(() => {
    return (localStorage.getItem("agent3_response_length") as any) || "detailed";
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        const selectedText = window.getSelection()?.toString().trim();
        if (selectedText) {
          setHighlightedContext(selectedText);
        }
        setIsOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const executeSend = async (textToSend: string, customContext?: string) => {
    if (!textToSend.trim() || isLoading) return;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const finalMessage = highlightedContext 
      ? `[Trích dẫn]: "${highlightedContext}"\n\nYêu cầu: ${textToSend}` 
      : textToSend;
      
    setHighlightedContext("");

    if (user && user.role === "student" && cooldownRemaining > 0) {
      setMessages(prev => [...prev, { role: "ai", text: `⏳ Bạn ơi, vui lòng đợi thêm ${cooldownRemaining} giây để đặt câu hỏi tiếp theo nhé!` }]);
      return;
    }
    
    setMessages(prev => [...prev, { role: "user", text: finalMessage }]);
    setIsLoading(true);
    
    if (user && user.role === "student") {
      startCooldown();
    }

    try {
      const idToken = await auth.currentUser?.getIdToken() || "";
      const baseContext = responseMode === "direct"
        ? `You are Agent 3 - Personal Assistant (Direct & Blunt Mode). STRICT RULES:\n- TRẢ LỜI TRỰC TIẾP.\n- FORMAT VẼ SƠ ĐỒ: Lệnh '/draw' -> mã Mermaid.js (mindmap).\n- Lệnh '/quiz': TRẢ VỀ code block \`\`\`quiz\n[{"q":"?","options":["A","B","C","D"],"correct":0,"explanation":"!"}]\n\`\`\`.`
        : `You are Agent 3 - Socrates AI Coach. STRICT RULES:\n- Gợi mở vấn đề.\n- FORMAT VẼ SƠ ĐỒ: Lệnh '/draw' -> mã Mermaid.js (mindmap).\n- Lệnh '/quiz': TRẢ VỀ code block \`\`\`quiz\n[{"q":"?","options":["A","B","C","D"],"correct":0,"explanation":"!"}]\n\`\`\`.`;
      
      const context = customContext ? `${baseContext}\nCurrent Context: ${customContext}` : baseContext;

      const res = await safeRequest("/api/agent3/chat", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
          "x-user-id": user?.id || "",
          "x-user-role": user?.role || "",
          "x-user-is-pro": user?.isPro ? "true" : "false"
        },
        signal: controller.signal,
        body: JSON.stringify({ 
          message: finalMessage, 
          history: messages.filter(m => !(m.role === "ai" && m.text.includes("⏳"))), 
          context, 
          sessionId, 
          lengthMode: responseLength,
          responseMode: responseMode
        })
      });

      if (!res.ok) {
        throw new Error("Lỗi kết nối Agent 3");
      }
      
      const data = await res.json();
      setMessages(prev => [...prev, { role: "ai", text: data.result }]);
    } catch (error: any) {
      if (error.name === "AbortError") {
        setIsLoading(false);
        return;
      }
      setMessages(prev => [...prev, { role: "ai", text: error?.message || "Tín hiệu bị nhiễu do bão mặt trời. Vui lòng thử lại." }]);
    }
    setIsLoading(false);
  };

  
  const handleQuickSaveCard = async (front: string, back: string) => {
    try {
      const cardObj = {
        id: uuidv4(),
        front,
        back,
        ipa: "",
        example: "",
        subject: "Agent 3",
        mastery: 0,
        isHard: false,
        nextReview: Date.now(),
        nextReviewDate: Date.now(),
        repetitionCount: 0,
        isNewCard: true
      };
      
      const aiDeckId = "deck_agent3_saved";
      let aiDeck = store.getDeck(aiDeckId);
      
      if (!aiDeck) {
        aiDeck = {
          id: aiDeckId,
          title: "Thẻ lưu từ Agent 3",
          subject: "AI",
          cards: [cardObj]
        };
      } else {
        aiDeck = { ...aiDeck, cards: [...(aiDeck.cards || []), cardObj] };
      }
      
      await store.addDeck(aiDeck);
      toast.success(`Đã lưu "${front}" vào bộ thẻ: Thẻ lưu từ Agent 3`);
    } catch (e) {
      toast.error("Lỗi khi lưu thẻ!");
      console.error(e);
    }
  };

  const handleSend = () => {
    executeSend(input);
    setInput("");
  };

  const handleQuickAction = (cmd: string) => {
    executeSend(cmd);
  };

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Handle extracting blocks
  const parseAIResponse = (text: string, msgIndex: number) => {
    const blocks: React.ReactNode[] = [];

    // Extract Mermaid and Quiz
    const blockRegex = /```(mermaid|quiz)\s*\n([\s\S]*?)```/g;
    let match;
    let lastIndex = 0;

    const processTextForCards = (t: string, keyPrefix: string) => {
      const textBlocks: React.ReactNode[] = [];
      const lines = t.split('\n');
      let buffer: string[] = [];
      let counter = 0;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const cardMatch = line.match(/^\*\*(.+?)\*\*\s*[:\-]\s*(.+)/);
        
        if (cardMatch) {
          if (buffer.length > 0) {
            textBlocks.push(
              <div key={`${keyPrefix}-buf-${counter++}`} className="prose dark:prose-invert prose-sm md:prose-base max-w-none">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{buffer.join('\n')}</ReactMarkdown>
              </div>
            );
            buffer = [];
          }
          textBlocks.push(
            <GenerativeFlashcard 
              key={`${keyPrefix}-card-${counter++}`} 
              front={cardMatch[1].trim()} 
              back={cardMatch[2].trim()} 
              onSave={() => handleQuickSaveCard(cardMatch[1].trim(), cardMatch[2].trim())} 
            />
          );
        } else {
          buffer.push(line);
        }
      }
      if (buffer.length > 0) {
        textBlocks.push(
          <div key={`${keyPrefix}-buf-${counter++}`} className="prose dark:prose-invert prose-sm md:prose-base max-w-none">
            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>{buffer.join('\n')}</ReactMarkdown>
          </div>
        );
      }
      return textBlocks;
    };

    while ((match = blockRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        blocks.push(...processTextForCards(text.substring(lastIndex, match.index), `text-${lastIndex}`));
      }
      const type = match[1];
      const code = match[2];
      
      if (type === "mermaid") {
        if (code.trim().startsWith("mindmap")) {
          blocks.push(<GenerativeMindmap key={`mermaid-${match.index}`} code={code} onAddCard={(label) => executeSend(`Phân tích khái niệm: ${label}`)} />);
        } else {
          blocks.push(<pre key={`code-${match.index}`} className="p-4 bg-zinc-900 text-zinc-100 rounded-xl my-4 text-xs overflow-x-auto">{code}</pre>);
        }
      } else if (type === "quiz") {
        try {
          const quizData = JSON.parse(code.trim());
          blocks.push(<GenerativeQuiz key={`quiz-${match.index}`} data={quizData} />);
        } catch (e) {
          blocks.push(<div key={`quiz-err-${match.index}`} className="text-red-500 text-xs">Lỗi parse JSON Quiz: {code.substring(0,50)}...</div>);
        }
      }
      
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      blocks.push(...processTextForCards(text.substring(lastIndex), `text-${lastIndex}`));
    }

    return <div className="space-y-4">{blocks}</div>;
  };

  return (
    <>
      <AnimatePresence>
      {!isOpen && (
        <motion.button 
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ duration: 0.3 }}
          onClick={() => setIsOpen(true)}
          id="agent3-side-widget-anchor"
          className="fixed bottom-6 right-6 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-full shadow-2xl flex items-center justify-center hover:scale-105 hover:bg-white dark:hover:bg-zinc-950 transition-all duration-300 z-50 group cursor-pointer p-3.5"
        >
          <Bot className="w-6 h-6 shrink-0 text-orange-500 group-hover:rotate-12 transition-transform" />
          <div className="flex items-center max-w-0 opacity-0 group-hover:max-w-[150px] group-hover:opacity-100 group-hover:ml-2.5 overflow-hidden transition-all duration-300 ease-in-out whitespace-nowrap gap-2">
            <span className="text-sm font-bold tracking-tight">Hỏi Agent 3</span>
            <span className="hidden sm:flex items-center justify-center text-[10px] font-mono font-black text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 uppercase tracking-wider shrink-0">⌘J</span>
          </div>
        </motion.button>
      )}
      </AnimatePresence>

      <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm z-40 transition-all duration-300"
            onClick={() => {
              if (abortControllerRef.current) abortControllerRef.current.abort();
              setIsLoading(false);
              setIsOpen(false);
            }}
          />
          <motion.div 
            layout
            initial={{ opacity: 0, y: isOmnibarMode ? -20 : 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: isOmnibarMode ? -20 : 20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={cn(
            "fixed z-50 flex flex-col bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden transition-all duration-300 border border-zinc-200/50 dark:border-zinc-800/80",
            isMaximized 
              ? "inset-0 sm:inset-4 sm:rounded-3xl" 
              : isOmnibarMode
                ? "top-[10%] left-4 right-4 sm:left-1/2 sm:-translate-x-1/2 sm:w-[700px] h-[75vh] sm:h-[650px] rounded-3xl"
                : "bottom-0 right-0 sm:bottom-6 sm:right-6 w-full sm:w-[420px] h-[85vh] sm:h-[600px] rounded-t-3xl sm:rounded-3xl"
          )}>
            
            {/* Header (Command Palette Style) */}
            <div className="flex-shrink-0 border-b border-zinc-100 dark:border-zinc-800/80 bg-white/50 dark:bg-zinc-950/50 backdrop-blur-md p-2">
              
              <AnimatePresence>
                {highlightedContext && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: 8 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    className="mx-2 mt-2"
                  >
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-3 flex items-start gap-3 relative">
                      <div className="mt-0.5"><Sparkles className="w-4 h-4 text-blue-500" /></div>
                      <div className="flex-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">Văn bản đang chọn</div>
                        <div className="text-sm text-blue-900 dark:text-blue-200 line-clamp-2 italic">"{highlightedContext}"</div>
                      </div>
                      <button onClick={() => setHighlightedContext("")} className="p-1 hover:bg-blue-100 dark:hover:bg-blue-800/50 rounded-lg text-blue-500 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center relative group py-1.5">
                <Bot className="w-5 h-5 text-orange-500 absolute left-4 top-5" />
                <textarea
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Hỏi Agent 3... (Bấm Send hoặc Ctrl+Enter để gửi)"
                  className="w-full bg-transparent pl-12 pr-[140px] py-4 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 focus:outline-none text-base sm:text-lg font-medium resize-none min-h-[56px] max-h-[150px]"
                  rows={1}
                  autoFocus
                />
                
                <div className="absolute right-2 top-3 flex items-center gap-1">
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className="p-2 rounded-xl transition-colors text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Gửi tin nhắn (Ctrl+Enter)"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                  {messages.length > 0 && (
                    <button 
                      onClick={() => {
                        if (abortControllerRef.current) abortControllerRef.current.abort();
                        setIsLoading(false);
                        setMessages([]);
                        setSessionId(uuidv4());
                      }} 
                      className="p-2 rounded-xl transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-500 dark:hover:text-red-400"
                      title="Xóa cuộc trò chuyện"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => setIsOmnibarMode(!isOmnibarMode)} className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-colors" title={isOmnibarMode ? "Chuyển sang Sidebar" : "Chuyển sang Omnibar"}>
                    {isOmnibarMode ? <LayoutTemplate className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </button>
                  <button onClick={() => {
                    if (abortControllerRef.current) abortControllerRef.current.abort();
                    setIsLoading(false);
                    setIsOpen(false);
                  }} className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Empty State / Suggestions */}
            {messages.length === 0 && (
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 flex flex-col justify-center items-center text-center">
                <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center mb-6">
                  <Brain className="w-8 h-8 text-orange-500" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">Xin chào, tôi là Agent 3</h3>
                <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8 max-w-sm">Trợ lý AI siêu việt giúp bạn phân tích chuyên sâu, tạo thẻ học và vẽ sơ đồ tư duy ngay lập tức.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                  <button onClick={() => handleQuickAction("/draw Bản đồ tư duy về Trí tuệ nhân tạo")} className="flex items-center gap-3 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-orange-500 hover:bg-orange-50/50 dark:hover:bg-orange-500/10 transition-all group text-left">
                    <Sparkles className="w-5 h-5 text-zinc-400 group-hover:text-orange-500" />
                    <div>
                      <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Vẽ sơ đồ tư duy</div>
                      <div className="text-xs text-zinc-500 line-clamp-1">Về chủ đề Trí tuệ nhân tạo</div>
                    </div>
                  </button>
                  <button onClick={() => handleQuickAction("Tóm tắt lại kiến thức cốt lõi tôi vừa học")} className="flex items-center gap-3 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-500/10 transition-all group text-left">
                    <MessageSquare className="w-5 h-5 text-zinc-400 group-hover:text-blue-500" />
                    <div>
                      <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Tóm tắt kiến thức</div>
                      <div className="text-xs text-zinc-500 line-clamp-1">Review lại bài học gần nhất</div>
                    </div>
                  </button>
                  <button onClick={() => handleQuickAction("Tạo 5 thẻ flashcard từ vựng IELTS nâng cao")} className="flex items-center gap-3 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-emerald-500/10 transition-all group text-left sm:col-span-2">
                    <Zap className="w-5 h-5 text-zinc-400 group-hover:text-emerald-500" />
                    <div>
                      <div className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Tạo bộ Flashcard tự động</div>
                      <div className="text-xs text-zinc-500 line-clamp-1">Ví dụ: 5 thẻ từ vựng IELTS nâng cao</div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Message Feed */}
            {messages.length > 0 && (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scroll-smooth">
                {messages.map((msg, idx) => (
                  <div key={idx} className={cn("flex flex-col", msg.role === "user" ? "items-end" : "items-start")}>
                    {msg.role === "user" ? (
                      <div className="bg-zinc-100 dark:bg-zinc-800/80 px-4 py-2.5 rounded-2xl rounded-tr-sm text-zinc-800 dark:text-zinc-200 text-[15px] max-w-[85%] border border-zinc-200/50 dark:border-zinc-700/50 shadow-sm">
                        {msg.text}
                      </div>
                    ) : (
                      <div className="w-full text-zinc-800 dark:text-zinc-200 text-[15px] leading-relaxed">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center">
                            <Bot className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="text-xs font-bold tracking-wider text-orange-600 dark:text-orange-400 uppercase">Agent 3</span>
                        </div>
                        <div className="pl-8">
                          {parseAIResponse(msg.text, idx)}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex flex-col items-start w-full">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center animate-pulse">
                        <Bot className="w-3.5 h-3.5 text-orange-500" />
                      </div>
                      <span className="text-xs font-bold tracking-wider text-zinc-400 uppercase animate-pulse">Đang phân tích...</span>
                    </div>
                    <div className="pl-8 w-1/2 h-12 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl animate-pulse" />
                  </div>
                )}
                <div ref={messagesEndRef} className="h-4" />
              </div>
            )}

          </motion.div>
        </>
      )}
      </AnimatePresence>
    </>
  );
}
