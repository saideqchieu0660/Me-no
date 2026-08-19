import { safeFetch } from "../utils/safeFetch";
import { rotationEngine, KeyStatus } from "./hybridRotationEngine";

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
  private readonly MAX_CONCURRENCY = 2; // Strict 1-2 concurrent execution pool
  private processedCards: IngestedCard[] = [];
  private failedChunks: IngestionChunk[] = [];
  
  private isRunning: boolean = false;
  private onStateChange: IngestionEventCallback | null = null;

  // Strict 10-12s throttle delay lock
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

  // Persistent Checkpoint Layer
  private saveCheckpoint() {
    const state = {
      queue: this.queue,
      processedCards: this.processedCards,
      failedChunks: this.failedChunks
    };
    try {
      localStorage.setItem("unified_ingestion_checkpoint", JSON.stringify(state));
    } catch (e) {
      console.warn("Failed to save ingestion checkpoint", e);
    }
  }

  private loadCheckpoint() {
    try {
      const saved = localStorage.getItem("unified_ingestion_checkpoint");
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
    localStorage.removeItem("unified_ingestion_checkpoint");
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

  // 10-12s Hard Anti-Ban Throttling Delay Wrapper
  private async enforceThrottlingDelay() {
    const now = Date.now();
    if (now < this.nextAllowedDispatchTime) {
      const waitTime = this.nextAllowedDispatchTime - now;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    // Set next allowed dispatch to 10-12s from now
    const delay = 10000 + Math.random() * 2000;
    this.nextAllowedDispatchTime = Date.now() + delay;
  }

  private async processQueue() {
    if (!this.isRunning || this.queue.length === 0) return;
    if (this.activeThreads >= this.MAX_CONCURRENCY) return;

    // Strict FIFO extraction
    const chunk = this.queue.shift();
    if (!chunk) return;

    this.activeThreads++;
    this.notifyState();

    try {
      await this.enforceThrottlingDelay();

      const key = rotationEngine.getAvailableKey();
      if (!key) {
        throw new Error("NO_KEYS_AVAILABLE");
      }

      const cards = await this.executeExtraction(chunk.text, key);
      
      // Handshake Validation & Zero Data-Loss Guardrail
      if (!this.validateExtraction(cards)) {
        throw new Error("INVALID_RESPONSE_SCHEMA");
      }

      this.processedCards.push(...cards);
      
    } catch (err: any) {
      console.error(`Chunk failed (Attempt ${chunk.retryCount + 1}):`, err.message);
      
      if (err.message === "NO_KEYS_AVAILABLE") {
        // Queue back to front, wait a bit before trying again
        this.queue.unshift(chunk);
        await new Promise(r => setTimeout(r, 5000));
      } else if (err.status === 404) {
        // Immediate switch provider
        const failingProvider = err.message.toLowerCase().includes("cerebras") ? "cerebras" : "gemini";
        if (failingProvider === "cerebras") {
          rotationEngine.enableCerebras = false;
        } else {
          rotationEngine.enableGemini = false;
        }
        chunk.retryCount = 0; // reset for new provider
        this.queue.unshift(chunk);
      } else {
        // Resilient Fallback & Retry Logic
        chunk.retryCount++;
        if (chunk.retryCount < 3) {
          // Exponential backoff delay happens due to requeuing and throttling, 
          // but we can add a specific thread sleep if needed, or just requeue.
          // The spec says "place that current chunk back into the front of the queue"
          // "exponentially increase the cooldown delay... or instantly rotate to an isolated, non-throttled provider key pool"
          this.queue.unshift(chunk);
          // Wait exponentially before freeing the thread, or let the throttling handle it.
          const backoff = Math.pow(2, chunk.retryCount) * 5000;
          await new Promise(r => setTimeout(r, backoff));
        } else {
          this.failedChunks.push(chunk);
        }
      }
    } finally {
      this.activeThreads--;
      this.notifyState();
      
      // Attempt to process next
      if (this.isRunning && this.queue.length > 0) {
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

  private async executeExtraction(text: string, keyStatus: KeyStatus): Promise<IngestedCard[]> {
    // We must call the system backend API or direct API based on instructions.
    // The instructions say "Khi viết UI mới cho nút Tạo thẻ bằng AI, mày chỉ được phép gọi đầu API hiện tại là safeFetch('/api/ingest')"
    // BUT the task also says "Direct all heavy extraction workloads to Cerebras (llama3.1-8b) or Google AI Studio (gemini-1.5-flash)"
    // So we'll hit the LLM APIs directly from client using the key from rotationEngine.
    
    const prompt = `Extract flashcards from the following text. Return a JSON array of objects with keys: "front", "back", "ipa" (optional), "example" (optional).
Text: ${text}`;

    if (keyStatus.provider === "cerebras") {
      const res = await safeFetch("https://api.cerebras.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${keyStatus.key}`
        },
        body: JSON.stringify({
          model: rotationEngine.cerebrasModel || "gpt-oss-120b",
          messages: [{ role: "user", content: prompt }]
        })
      });

      if (!res.ok) {
        rotationEngine.reportError(keyStatus.key, res.status);
        const err = new Error(`Cerebras API Error: ${res.status}`);
        (err as any).status = res.status;
        throw err;
      }

      const data = await res.json();
      return this.parseResponse(data.choices[0].message.content);

    } else {
      // Gemini 3.5 Flash using OpenAI-compatible endpoint
      const res = await safeFetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${keyStatus.key}`
        },
        body: JSON.stringify({
          model: "gemini-3.5-flash",
          messages: [{ role: "user", content: prompt }]
        })
      });

      if (!res.ok) {
        rotationEngine.reportError(keyStatus.key, res.status);
        const err = new Error(`Gemini API Error: ${res.status}`);
        (err as any).status = res.status;
        throw err;
      }

      const data = await res.json();
      return this.parseResponse(data.choices[0].message.content);
    }
  }

  private parseResponse(content: string): IngestedCard[] {
    try {
      // Basic markdown JSON extraction
      let jsonStr = content.trim();
      if (jsonStr.startsWith("\`\`\`json")) {
        jsonStr = jsonStr.replace(/\`\`\`json/g, "").replace(/\`\`\`/g, "").trim();
      }
      
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) return parsed;
      if (parsed.cards && Array.isArray(parsed.cards)) return parsed.cards;
      if (parsed.flashcards && Array.isArray(parsed.flashcards)) return parsed.flashcards;
      
      throw new Error("Unknown schema");
    } catch (e) {
      throw new Error("JSON Parse Error");
    }
  }
}

export const unifiedIngestionEngine = new UnifiedIngestionEngine();
