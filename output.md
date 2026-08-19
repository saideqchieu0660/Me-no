1. Files/functions created/changed
- Created: `src/lib/CardStateManager.ts`
- Created: `src/lib/CardStateManager.test.ts` (mock definitions for CI)
- Exported: `PersonalCardState` interface
- Exported: `CardStateManager` singleton instance

2. PersonalCardState schema
```typescript
export interface PersonalCardState {
  cardId: string;
  userId: string;
  mastery: number;
  isHard: boolean;
  repetitionCount: number;
  interval: number;
  easeFactor: number;
  nextReviewDate: number;
  lastPointAwarded: number;
  updatedAt: number;
}
```

3. CardStateManager API
- `getCardState(userId: string, cardId: string): PersonalCardState | undefined` (Synchronous memory read)
- `getAllStates(userId: string): PersonalCardState[]` (Synchronous memory read)
- `updateCardState(userId: string, cardId: string, patch: Partial<PersonalCardState>)` (Patch, increments `updatedAt`, updates memory, triggers subscribers, writes to IDB asynchronously)
- `hydrateStates(userId: string): Promise<void>` (Loads from IDB, executes read-only migration)
- `subscribe(cardId: string, listener: Subscriber)` (For React hooks)

4. IndexedDB schema
- Table prefix: `vibe_personal_card_states_v1_`
- Key format: `vibe_personal_card_states_v1_{userId}_{cardId}`
- Value: The full JSON object of `PersonalCardState`

5. Migration behavior
- Idempotent: Executed during `hydrateStates` without deleting legacy data.
- Step 1: Reads `vibe_cardstate_*` from IndexedDB. If `lastUpdatedAt` > memory's `updatedAt`, merges and bumps.
- Step 2: Reads `cardsState` from Firestore (if online). Merges over memory if timestamp is newer.
- Step 3: Reads `weak_cards_*` from localStorage. Applies `isHard: true` ONLY IF the current state's `updatedAt === 0` (meaning it was never synced from a reliable source). Deliberately DOES NOT bump the timestamp so a real sync can overwrite it safely.
- Step 4: Writes migrated results directly to the new `vibe_personal_card_states_v1_` IndexedDB format.

6. Tests executed
- `compile_applet` executed successfully (Vite + TypeScript validation passed).
- Test script successfully created a card, verified initial setup, updated multiple states, verified timestamp increments, and validated mock DB persistence.

7. Build result
- Passed without compilation warnings or typing errors.

8. Verdict
CODE VERIFIED
AUTOMATED TEST PASSED

9. Known limitations
- Currently no Background Sync worker for Firestore write-back. It saves to IDB and Memory immediately, but pushing to Firestore on every update needs to be wired up or handled via the existing sync engine later.
- UI components are not yet migrated to `CardStateManager` (as instructed). Legacy features still rely on `store.decks` and local mutations.
