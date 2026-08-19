import { nextGenRotationEngine, KeyStatus } from "./hybridRotationEngine";
import { toast } from "sonner";
import { nextGenPromptManager } from "./promptManager";

import { executeCerebrasExtraction } from "./cerebrasClient";

export interface IngestionChunk {
  id: string;
  text: string;
  retryCount: number;
}

export interface IngestedCard {
  front: string;
  back: string;
  ipa?: string;
  example?: string;
}

export interface IngestionState {
  pendingChunks: IngestionChunk[];
  processedCards: IngestedCard[];
  failedChunks: IngestionChunk[];
}

export type IngestionEventCallback = (state: IngestionState, currentProcessing: number) => void;

class UnifiedIngestionEngine {
  private queue: IngestionChunk[] = [];
  private activeThreads: number = 0;
  private readonly MAX_CONCURRENCY = 1; // Strict cap of 1
  private processedCards: IngestedCard[] = [];
  private failedChunks: IngestionChunk[] = [];
  
  private isRunning: boolean = false;
  private onStateChange: IngestionEventCallback | null = null;
  private nextAllowedDispatchTime: number = 0;

  constructor() {
    this.loadCheckpoint();
  }

  public setOnStateChange(callback: IngestionEventCallback) {
    this.onStateChange = callback;
  }

  private notifyState() {
    if (this.onStateChange) {
      this.onStateChange({
        pendingChunks: [...this.queue],
        processedCards: [...this.processedCards],
        failedChunks: [...this.failedChunks]
      }, this.activeThreads);
    }
    this.saveCheckpoint();
  }

  private saveCheckpoint() {
    const state = {
      queue: this.queue,
      processedCards: this.processedCards,
      failedChunks: this.failedChunks
    };
    try {
      localStorage.setItem("nextgen_ingestion_checkpoint", JSON.stringify(state));
    } catch (e) {
      console.warn("Failed to save ingestion checkpoint", e);
    }
  }

  private loadCheckpoint() {
    try {
      const saved = localStorage.getItem("nextgen_ingestion_checkpoint");
      if (saved) {
        const state = JSON.parse(saved);
        this.queue = state.queue || [];
        this.processedCards = state.processedCards || [];
        this.failedChunks = state.failedChunks || [];
      }
    } catch (e) {
      console.warn("Failed to load ingestion checkpoint", e);
    }
  }

  public clearCheckpoint() {
    this.queue = [];
    this.processedCards = [];
    this.failedChunks = [];
    localStorage.removeItem("nextgen_ingestion_checkpoint");
    this.notifyState();
  }

  public enqueueChunks(texts: string[]) {
    const newChunks = texts.map(text => ({
      id: crypto.randomUUID(),
      text,
      retryCount: 0
    }));
    this.queue.push(...newChunks);
    this.notifyState();
    this.start();
  }

  public start() {
    if (!this.isRunning) {
      this.isRunning = true;
    }
    this.processQueue();
  }

  public stop() {
    this.isRunning = false;
  }
  
  public async processSingleChunkSync(text: string, pushLog?: (msg: string, isError?: boolean) => void): Promise<IngestedCard[]> {
    if (!nextGenPromptManager.isContentSafe(text)) {
      throw new Error("Policy Violation: Nội dung vi phạm chính sách hoặc chứa lệnh không hợp lệ.");
    }

    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount < maxRetries) {
      try {
        await this.enforceThrottlingDelay();

        const keyStatus = nextGenRotationEngine.getAvailableKey();
        if (!keyStatus) {
          throw new Error("NO_KEYS_AVAILABLE");
        }

        if (pushLog) {
          pushLog(`[HYBRID POOL] Selected active provider key: ${keyStatus.maskedKey} (Status: READY)`);
          pushLog(`[THROTTLE] Enforcing 10-12 seconds interval protection...`);
        }

        nextGenRotationEngine.markKeyUsed(keyStatus.key);

        const cards = await this.executeExtraction(text, keyStatus, pushLog);
        
        if (!this.validateExtraction(cards)) {
          throw new Error("INVALID_RESPONSE_SCHEMA");
        }
        
        return cards;
      } catch (err: any) {
        if (err.message === "NO_KEYS_AVAILABLE") {
          throw err;
        }
        
        if (err.status === 404) {
          if (pushLog) {
            pushLog(`🛑 Nhận lỗi 404 từ nhà cung cấp. Ngay lập tức đánh dấu không thể thử lại trên cùng provider và thực hiện chuyển đổi...`, true);
          }
          // HTTP 404 is non-retryable on the current provider. Stop retrying and switch provider.
          const failingProvider = err.message.toLowerCase().includes("cerebras") ? "cerebras" : "gemini";
          // We only have cerebras now
          retryCount = 0;
          continue;
        }

        retryCount++;
        if (pushLog) {
          pushLog(`⚠️ Lỗi xử lý khối (Thử lại ${retryCount}/${maxRetries}): ${err.message}`, true);
        }
        if (retryCount >= maxRetries) {
          throw err;
        }
      }
    }
    throw new Error("Quá số lần thử lại.");
  }

  private async enforceThrottlingDelay() {
    const now = Date.now();
    if (now < this.nextAllowedDispatchTime) {
      const waitTime = this.nextAllowedDispatchTime - now;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    // Random delay between 10s and 12s
    const delay = 10000 + Math.random() * 2000;
    this.nextAllowedDispatchTime = Date.now() + delay;
  }

  private async processQueue() {
    if (!this.isRunning || this.queue.length === 0) return;
    if (this.activeThreads >= this.MAX_CONCURRENCY) return;

    const chunk = this.queue.shift();
    if (!chunk) return;

    if (!nextGenPromptManager.isContentSafe(chunk.text)) {
      toast.error("Policy Violation: Nội dung vi phạm chính sách hoặc chứa lệnh không hợp lệ.");
      this.failedChunks.push(chunk);
      this.notifyState();
      if (this.isRunning && this.queue.length > 0) {
        this.processQueue();
      }
      return;
    }

    this.activeThreads++;
    this.notifyState();

    let dispatchError = false;

    try {
      // 1. Mandatory Delay
      await this.enforceThrottlingDelay();

      // 2. Select Key
      const key = nextGenRotationEngine.getAvailableKey();
      if (!key) {
        throw new Error("NO_KEYS_AVAILABLE");
      }
      
      nextGenRotationEngine.markKeyUsed(key.key);

      // 3. Execution
      const cards = await this.executeExtraction(chunk.text, key);
      
      // 4. Validation
      if (!this.validateExtraction(cards)) {
        throw new Error("INVALID_RESPONSE_SCHEMA");
      }

      // 5. Success Checkpoint
      this.processedCards.push(...cards);
      
    } catch (err: any) {
      console.error(`[NextGen] Chunk failed (Attempt ${chunk.retryCount + 1}):`, err.message);
      dispatchError = true;
      
      if (err.message === "NO_KEYS_AVAILABLE") {
        this.queue.unshift(chunk);
        this.stop(); // Stop loop and allow resume
      } else if (err.status === 404) {
        // Immediate switch provider
        const failingProvider = err.message.toLowerCase().includes("cerebras") ? "cerebras" : "gemini";
        // Place back at the front of the queue to try with the other provider
        this.queue.unshift(chunk);
      } else {
        chunk.retryCount++;
        if (chunk.retryCount < 3) {
          this.queue.unshift(chunk); // push back to front
        } else {
          this.failedChunks.push(chunk);
        }
      }
    } finally {
      this.activeThreads--;
      this.notifyState();
      
      if (this.isRunning && this.queue.length > 0 && !dispatchError) {
        this.processQueue();
      }
    }
  }

  private validateExtraction(cards: any[]): boolean {
    if (!Array.isArray(cards) || cards.length === 0) return false;
    for (const c of cards) {
      if (!c.front || !c.back) return false;
    }
    return true;
  }

  private async executeExtraction(text: string, keyStatus: KeyStatus, pushLog?: (msg: string, isError?: boolean) => void): Promise<IngestedCard[]> {
    let basePrompt = nextGenPromptManager.getIngestionPrompt();
    if (!basePrompt || basePrompt.trim() === "") {
        basePrompt = `Extract flashcards from the following text. Return a JSON array of objects exactly like this:
[
  { "front": "word/phrase", "back": "translation/meaning", "ipa": "pronunciation", "example": "example sentence" }
]
Only output the raw JSON array, no extra text.`;
    }
    const prompt = `${basePrompt}\nText: ${text}`;

    try {
      let content = "";
      if (keyStatus.provider === "cerebras") {
        content = await executeCerebrasExtraction(prompt, keyStatus.key, pushLog);
      }
      return this.parseResponse(content, pushLog);
    } catch (error: any) {
      if (error.status) {
        nextGenRotationEngine.reportError(keyStatus.key, error.status);
      } else {
        nextGenRotationEngine.reportError(keyStatus.key, 500);
      }
      throw error;
    }
  }

  private parseResponse(content: string, pushLog?: (msg: string, isError?: boolean) => void): IngestedCard[] {
    let jsonStr = content.trim();
    // Strip markdown code fences if present
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
    }
    
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) return parsed;
      if (parsed.cards && Array.isArray(parsed.cards)) return parsed.cards;
      if (parsed.flashcards && Array.isArray(parsed.flashcards)) return parsed.flashcards;
      
      throw new Error("Unknown schema");
    } catch (e: any) {
      if (pushLog) {
        pushLog(`[PARSE ERROR] Raw response: ${content}`, true);
      }
      throw new Error("JSON Parse Error: " + e.message);
    }
  }
}

export const nextGenIngestionEngine = new UnifiedIngestionEngine();
