// Mock import.meta.env before anything else
(global as any).import = { meta: { env: { VITE_FIREBASE_API_KEY: "dummy" } } };
(global as any).window = {};

// Then import
import { CardStateManager, _setTestMocks } from './CardStateManager';


// Mock DB
const idbMock: Record<string, any> = {};

// Inject mocks
_setTestMocks(
  async (key: string) => idbMock[key],
  async (key: string, val: any) => { idbMock[key] = val; },
  async () => Object.keys(idbMock),
  async () => ({ forEach: () => {} }) // mock fsGetDocs
);

async function runTests() {
  console.log("Running CardStateManager Tests...");
  
  const userId = "test_user_123";
  const cardId = "test_card_abc";

  // 1. Create state
  await CardStateManager.updateCardState(userId, cardId, { mastery: 20 });
  let state = CardStateManager.getCardState(userId, cardId);
  if (state?.mastery !== 20) throw new Error("Failed to create state");
  const initialTimestamp = state.updatedAt;

  // 2. Update multiple times
  await new Promise(r => setTimeout(r, 10)); // ensure timestamp change
  await CardStateManager.updateCardState(userId, cardId, { isHard: true });
  state = CardStateManager.getCardState(userId, cardId);
  if (!state?.isHard || state.mastery !== 20) throw new Error("Patch failed");
  if (state.updatedAt <= initialTimestamp) throw new Error("Timestamp did not bump");

  // 3. Update multiple cards
  const card2 = "test_card_xyz";
  await CardStateManager.updateCardState(userId, card2, { mastery: 100 });
  const allStates = CardStateManager.getAllStates(userId);
  if (allStates.length < 2) throw new Error("Failed to retrieve multiple cards");

  // 4. Test IDB persistance
  const idbState = idbMock[`vibe_personal_card_states_v1_${userId}_${cardId}`];
  if (!idbState || idbState.mastery !== 20 || !idbState.isHard) throw new Error("IDB persistence failed");

  console.log("✅ All automated tests passed!");
}

runTests().catch(e => {
  console.error("❌ Test failed:", e);
  process.exit(1);
});

