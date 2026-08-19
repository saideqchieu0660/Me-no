export type KeyStatus = {
  provider: 'cerebras' | 'gemini';
  index: number;
  key: string;
  maskedKey: string;
  status: 'READY' | 'COOLING_DOWN' | 'ISOLATED';
  usageCount: number;
};

import { store } from "../../lib/store";

class HybridRotationEngine {
  private systemKeys: KeyStatus[] = [];
  public cerebrasModel: string = "llama-3.3-70b";
  public geminiModel: string = "gemini-3.5-flash";
  private currentCerebrasIndex: number = 0;
  
  public enableCerebras: boolean = true;
  public enableGemini: boolean = false;

  constructor() {
    this.initializeKeys();
  }

  private initializeKeys() {
    // Collect System Cerebras keys from Vercel env for Admins
    for (let i = 1; i <= 20; i++) {
      const key = import.meta.env[`VITE_CEREBRAS_KEY_${i}`];
      if (key) {
        this.systemKeys.push({
          provider: 'cerebras',
          index: i,
          key,
          maskedKey: this.maskKey(key),
          status: 'READY',
          usageCount: 0
        });
      }
    }
  }

  private maskKey(key: string): string {
    if (!key) return "";
    if (key.length <= 8) return "***";
    return `${key.slice(0, 4)}***${key.slice(-4)}`;
  }

  public getKeysStatus(): KeyStatus[] {
    const byokKey = localStorage.getItem("henosis_cerebras_key");
    if (byokKey) {
      return [{
        provider: 'cerebras',
        index: 0,
        key: byokKey,
        maskedKey: this.maskKey(byokKey),
        status: 'READY',
        usageCount: 0
      }];
    }
    return this.systemKeys;
  }

  public setToggles(cerebras: boolean, gemini: boolean) {
    // Legacy method, do nothing as we only use Cerebras now
  }

  public async verifyHandshake(provider: 'cerebras' | 'gemini'): Promise<boolean> {
    if (provider !== 'cerebras') return false;

    const testKey = this.getAvailableKey();
    if (!testKey) return false;

    try {
      const resModels = await fetch("https://api.cerebras.ai/v1/models", {
        headers: { "Authorization": `Bearer ${testKey.key}` }
      });
      if (resModels.ok) {
        const data = await resModels.json();
        const availableModels = data.data.map((m: any) => m.id);
        let selectedModel = this.cerebrasModel;
        if (!availableModels.includes(selectedModel)) {
          selectedModel = availableModels.find((m: string) => !m.includes("embed")) || availableModels[0];
          if (selectedModel) {
            this.cerebrasModel = selectedModel;
          }
        }
      }
    } catch (err) {
      console.warn("[Cerebras Discovery] Failed to fetch models:", err);
    }

    try {
      const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${testKey.key}`
        },
        body: JSON.stringify({
          model: this.cerebrasModel,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1
        })
      });
      if (res.ok) {
        console.log(`[Cerebras Discovery] Verified and selected model: ${this.cerebrasModel}`);
        return true;
      } else {
        this.isolateKey(testKey.key);
        return false;
      }
    } catch (e) {
      this.isolateKey(testKey.key);
      return false;
    }
  }

  public getAvailableKey(): KeyStatus | null {
    // 1. Try to get BYOK
    const byok = localStorage.getItem("henosis_cerebras_key");
    if (byok) {
       return { provider: 'cerebras', index: 0, key: byok, maskedKey: this.maskKey(byok), status: 'READY', usageCount: 0 };
    }
    
    // 2. If no BYOK, check if user is admin
    const user = store.getCurrentUser();
    const isUserAdminOrTeacher = user?.role === "teacher" || user?.role === "admin" || user?.role === "Admin";
    if (isUserAdminOrTeacher) {
      const systemCandidates = this.systemKeys.filter(k => k.status === 'READY');
      if (systemCandidates.length > 0) {
        this.currentCerebrasIndex = (this.currentCerebrasIndex + 1) % systemCandidates.length;
        return systemCandidates[this.currentCerebrasIndex];
      }
    }
    
    // 3. No key available (user must provide BYOK)
    return null; 
  }

  public markKeyUsed(keyString: string) {
    const key = this.systemKeys.find(k => k.key === keyString);
    if (key) {
      key.usageCount++;
      key.status = 'COOLING_DOWN';
      setTimeout(() => {
        if (key.status === 'COOLING_DOWN') {
          key.status = 'READY';
        }
      }, 12000);
    }
  }

  public isolateKey(keyString: string) {
    const key = this.systemKeys.find(k => k.key === keyString);
    if (key) {
      key.status = 'ISOLATED';
      setTimeout(() => {
        if (key.status === 'ISOLATED') {
          key.status = 'READY';
        }
      }, 60000);
    }
  }
  
  public reportError(keyString: string, status: number) {
    if (status === 404 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
      this.isolateKey(keyString);
    }
  }
}

export const nextGenRotationEngine = new HybridRotationEngine();
