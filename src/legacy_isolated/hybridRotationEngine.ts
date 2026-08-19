export interface KeyStatus {
  key: string;
  provider: 'cerebras' | 'gemini';
  index: number;
  status: 'READY' | 'COOLING_DOWN' | 'ISOLATED';
  lastUsed: number; // timestamp
  isolatedUntil: number | null; // timestamp
  usageCount: number;
  maskedKey: string;
}

class HybridRotationEngine {
  private keys: KeyStatus[] = [];
  private currentPointer: number = 0;
  
  // Toggles
  public enableCerebras: boolean = true;
  public enableGemini: boolean = true;
  public cerebrasModel: string = "gpt-oss-120b";

  constructor() {
    this.initializeKeys();
  }

  private initializeKeys() {
    const keysRaw: KeyStatus[] = [];
    const safeProcessEnv = typeof process !== "undefined" && process?.env ? process.env : {};

    // 1. Initialize Cerebras Keys
    let cerebrasIdx = 1;
    for (let i = 1; i <= 20; i++) {
      let k = (import.meta as any).env[`VITE_CEREBRAS_KEY_${i}`] || safeProcessEnv[`VITE_CEREBRAS_KEY_${i}`];
      if (k && typeof k === "string" && k.trim()) {
        const key = k.trim();
        keysRaw.push({
          key,
          provider: 'cerebras',
          index: cerebrasIdx++,
          status: 'READY',
          lastUsed: 0,
          isolatedUntil: null,
          usageCount: 0,
          maskedKey: this.maskKey(key, 'cerebras'),
        });
      }
    }

    // 2. Initialize Gemini Keys
    let geminiIdx = 1;
    for (let i = 1; i <= 20; i++) {
      let k = (import.meta as any).env[`VITE_GEMINI_API_KEY_${i}`] || safeProcessEnv[`VITE_GEMINI_API_KEY_${i}`] || (import.meta as any).env[`VITE_GOOGLE_KEY_${i}`];
      if (k && typeof k === "string" && k.trim()) {
        const key = k.trim();
        keysRaw.push({
          key,
          provider: 'gemini',
          index: geminiIdx++,
          status: 'READY',
          lastUsed: 0,
          isolatedUntil: null,
          usageCount: 0,
          maskedKey: this.maskKey(key, 'gemini'),
        });
      }
    }
    
    this.keys = keysRaw;
  }

  private maskKey(key: string, provider: string): string {
    if (key.length <= 8) return "Secret";
    if (provider === 'cerebras') {
      return `csk_...${key.substring(key.length - 4)}`;
    } else {
      return `AIza...${key.substring(key.length - 4)}`;
    }
  }

  public getKeysStatus(): KeyStatus[] {
    const now = Date.now();
    
    // Update cooldown and isolation statuses
    this.keys.forEach(k => {
      if (k.status === 'ISOLATED' && k.isolatedUntil && now > k.isolatedUntil) {
        k.status = 'READY';
        k.isolatedUntil = null;
      } else if (k.status === 'COOLING_DOWN' && now - k.lastUsed >= 12000) {
        k.status = 'READY';
      }
    });

    return this.keys.map(k => ({...k})); // return copies
  }

  public setToggles(cerebras: boolean, gemini: boolean) {
    this.enableCerebras = cerebras;
    this.enableGemini = gemini;
  }

  public getAvailableKey(): KeyStatus | null {
    const now = Date.now();
    const totalKeys = this.keys.length;
    
    if (totalKeys === 0) return null;

    let attempts = 0;
    while (attempts < totalKeys) {
      const candidate = this.keys[this.currentPointer];
      
      // Move pointer in round-robin fashion
      this.currentPointer = (this.currentPointer + 1) % totalKeys;
      attempts++;

      // Check toggles
      if (candidate.provider === 'cerebras' && !this.enableCerebras) continue;
      if (candidate.provider === 'gemini' && !this.enableGemini) continue;

      // Update transient states
      if (candidate.status === 'ISOLATED' && candidate.isolatedUntil && now > candidate.isolatedUntil) {
        candidate.status = 'READY';
        candidate.isolatedUntil = null;
      }
      
      if (candidate.status === 'COOLING_DOWN' && now - candidate.lastUsed >= 12000) {
        candidate.status = 'READY';
      }

      // 10-12s cooldown enforced (using 10s as min boundary to be safe, logic updates status above to 12)
      if (candidate.status === 'READY') {
        const cooldownTime = 10000 + Math.random() * 2000; // 10s - 12s
        candidate.status = 'COOLING_DOWN';
        candidate.lastUsed = now;
        candidate.usageCount++;
        return candidate;
      }
    }

    return null; // All keys are exhausted/isolated/cooling down
  }

  public reportError(keyString: string, statusCode: number) {
    const keyObj = this.keys.find(k => k.key === keyString);
    if (!keyObj) return;

    if (statusCode === 404) {
      keyObj.status = 'ISOLATED';
      keyObj.isolatedUntil = Date.now() + 60000;
      return;
    }

    if (statusCode === 429 || statusCode === 500 || statusCode === 502 || statusCode === 503 || statusCode === 504) {
      keyObj.status = 'ISOLATED';
      keyObj.isolatedUntil = Date.now() + 60000; // 60 seconds lock
    }
  }

  public async verifyHandshake(provider: 'cerebras' | 'gemini'): Promise<boolean> {
    const candidate = this.keys.find(k => k.provider === provider);
    if (!candidate) return false; // No keys available for provider

    try {
      if (provider === 'cerebras') {
        try {
          const resModels = await fetch("https://api.cerebras.ai/public/v1/models");
          if (resModels.ok) {
            const data = await resModels.json();
            const availableModels = data.data.map((m: any) => m.id);
            
            let selectedModel = this.cerebrasModel;
            if (!availableModels.includes(selectedModel)) {
              // switch to the first available production chat model
              selectedModel = availableModels.find((m: string) => !m.includes("embed")) || availableModels[0];
              if (selectedModel) {
                this.cerebrasModel = selectedModel;
              }
            }
          }
        } catch (err) {
          console.warn("[Cerebras Discovery] Failed to fetch models:", err);
        }

        const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${candidate.key}`
          },
          body: JSON.stringify({
            model: this.cerebrasModel,
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 1
          })
        });
        return res.ok;
      } else {
        // Simple Gemini API verification ping
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${candidate.key}`);
        return res.ok;
      }
    } catch (e) {
      return false;
    }
  }
}

export const rotationEngine = new HybridRotationEngine();
