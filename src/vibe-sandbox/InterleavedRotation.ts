export type KeyStatus = "active" | "rate_limited" | "blacklisted";

export interface KeyState {
  key: string;
  status: KeyStatus;
  errorCount: number;
}

export interface ProviderConfig {
  name: string;
  keys: KeyState[];
  verticalPointer?: number;
}

export class InterleavedRotationEngine {
  private providers: Required<ProviderConfig>[] = [];
  private currentProviderIndex: number = 0;

  constructor(providers: ProviderConfig[]) {
    // Initialize vertical pointers safely
    this.providers = providers.map(p => ({
      ...p,
      verticalPointer: p.verticalPointer || 0
    }));
  }

  /**
   * Core Interleaved / Horizontal Round Robin logic.
   * - Takes the current provider's vertical pointer.
   * - Safely wraps around individual key arrays using modulo.
   * - Automatically advances to the next provider (horizontal movement).
   * - Preserves blacklisting/circuit breaking by skipping dead keys.
   */
  public getNextValidKey(): { providerName: string; keyState: KeyState } | null {
    if (this.providers.length === 0) return null;

    let attempts = 0;
    // Calculate total keys to prevent infinite loops if all are blacklisted
    const maxAttempts = this.providers.reduce((sum, p) => sum + p.keys.length, 0);

    while (attempts < maxAttempts) {
      // 1. Horizontal Selection
      const provider = this.providers[this.currentProviderIndex];
      
      // Advance horizontal pointer for the NEXT turn
      this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;
      
      if (provider.keys.length === 0) {
        attempts++;
        continue;
      }

      // 2. Vertical Selection (Wrap around individual array length safely)
      const keyIndex = provider.verticalPointer % provider.keys.length;
      const keyState = provider.keys[keyIndex];

      // Advance vertical pointer for THIS provider's NEXT turn
      provider.verticalPointer = (provider.verticalPointer + 1) % provider.keys.length;

      attempts++;

      // 3. Circuit Breaker / Blacklist check
      if (keyState.status === "active") {
         return {
           providerName: provider.name,
           keyState
         };
      }
      
      // If blacklisted, the loop continues to the next interleaved candidate seamlessly
    }

    throw new Error("Rotation Engine Exhausted: All keys across all providers are currently blacklisted or unavailable.");
  }

  // Helper to simulate blacklisting a key (Circuit Breaker)
  public blacklistKey(providerName: string, keyString: string) {
    const provider = this.providers.find(p => p.name === providerName);
    if (provider) {
      const keyState = provider.keys.find(k => k.key === keyString);
      if (keyState) {
        keyState.status = "blacklisted";
        keyState.errorCount++;
      }
    }
  }
}

// ============================================================================
// SIMULATION & TEST CASE
// ============================================================================

export function runSimulation() {
  console.log("=== STARTING INTERLEAVED ROTATION SIMULATION ===");

  const providers: ProviderConfig[] = [
    {
      name: "Provider_A",
      keys: [
        { key: "A_Key_0", status: "active", errorCount: 0 },
        { key: "A_Key_1", status: "active", errorCount: 0 }
      ]
    },
    {
      name: "Provider_B",
      keys: [
        { key: "B_Key_0", status: "active", errorCount: 0 },
        { key: "B_Key_1", status: "active", errorCount: 0 },
        { key: "B_Key_2", status: "active", errorCount: 0 } // Extra key to show uneven wrap
      ]
    },
    {
      name: "Provider_C",
      keys: [
        { key: "C_Key_0", status: "active", errorCount: 0 },
        { key: "C_Key_1", status: "active", errorCount: 0 }
      ]
    }
  ];

  const engine = new InterleavedRotationEngine(providers);

  console.log("\\n--- Normal Interleaved Flow (6 requests) ---");
  for (let i = 1; i <= 6; i++) {
    const result = engine.getNextValidKey();
    console.log(`Request ${i}: Routed to [${result?.providerName}] -> Key: ${result?.keyState.key}`);
  }

  console.log("\\n--- Simulating Circuit Breaker (Blacklisting Provider_A's current key) ---");
  console.log("Blacklisting 'A_Key_0'...");
  engine.blacklistKey("Provider_A", "A_Key_0");

  console.log("\\n--- Flow after Blacklisting (6 requests) ---");
  for (let i = 7; i <= 12; i++) {
    const result = engine.getNextValidKey();
    console.log(`Request ${i}: Routed to [${result?.providerName}] -> Key: ${result?.keyState.key}`);
  }
  
  console.log("\\n=== SIMULATION COMPLETE ===");
}

// Auto-run if executed directly via Node/TSX
const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('InterleavedRotation.ts');
if (isMain) {
  runSimulation();
}
