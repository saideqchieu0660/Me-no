import { get, set, keys } from "idb-keyval";
import { db } from "./firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

// Mock hooks for testing
let _mockGet: typeof get | null = null;
let _mockSet: typeof set | null = null;
let _mockKeys: typeof keys | null = null;
let _mockGetDocs: typeof getDocs | null = null;

export const _setTestMocks = (mGet: any, mSet: any, mKeys: any, mGetDocs: any) => {
  _mockGet = mGet;
  _mockSet = mSet;
  _mockKeys = mKeys;
  _mockGetDocs = mGetDocs;
};

const idbGet = async <T>(key: IDBValidKey): Promise<T | undefined> => _mockGet ? _mockGet(key) : get<T>(key);
const idbSet = async (key: IDBValidKey, val: any): Promise<void> => _mockSet ? _mockSet(key, val) : set(key, val);
const idbKeys = async (): Promise<IDBValidKey[]> => _mockKeys ? _mockKeys() : keys();
const fsGetDocs = async (ref: any): Promise<any> => _mockGetDocs ? _mockGetDocs(ref) : getDocs(ref);


import { useEffect, useState, useCallback } from "react";

export function useCardState(userId: string | undefined, cardId: string | undefined): PersonalCardState | undefined {
  const [state, setState] = useState<PersonalCardState | undefined>(() => {
    if (!userId || !cardId) return undefined;
    return CardStateManager.getCardState(userId, cardId);
  });

  useEffect(() => {
    if (!userId || !cardId) {
      setState(undefined);
      return;
    }

    // Hydrate just in case
    CardStateManager.hydrateStates(userId);

    const handleUpdate = (id: string, newState: PersonalCardState) => {
      setState(newState);
    };

    setState(CardStateManager.getCardState(userId, cardId));
    return CardStateManager.subscribe(cardId, handleUpdate);
  }, [userId, cardId]);

  return state;
}

export function useCardStates(userId: string | undefined, cardIds: string[]): Record<string, PersonalCardState> {
  const [states, setStates] = useState<Record<string, PersonalCardState>>({});

  useEffect(() => {
    if (!userId) return;
    CardStateManager.hydrateStates(userId).then(() => {
       const initial: Record<string, PersonalCardState> = {};
       cardIds.forEach(id => {
         const s = CardStateManager.getCardState(userId, id);
         if (s) initial[id] = s;
       });
       setStates(initial);
    });

    const unsubs = cardIds.map(id => {
      return CardStateManager.subscribe(id, (updatedId, newState) => {
        setStates(prev => ({ ...prev, [updatedId]: newState }));
      });
    });

    return () => unsubs.forEach(unsub => unsub());
  }, [userId, JSON.stringify(cardIds)]);

  return states;
}
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

type Subscriber = (cardId: string, state: PersonalCardState) => void;

class CardStateManagerClass {
  // In-memory cache for fast sync reads
  // Key: userId_cardId
  private stateCache: Map<string, PersonalCardState> = new Map();
  private subscribers: Map<string, Subscriber[]> = new Map();
  private hydratedUsers: Set<string> = new Set();
  private hydratingUsers: Set<string> = new Set();

  // Generates cache key
  private getKey(userId: string, cardId: string) {
    return `${userId}_${cardId}`;
  }

  private getStoreKey(userId: string, cardId: string) {
    return `vibe_personal_card_states_v1_${userId}_${cardId}`;
  }

  // Synchronous read from cache
  getCardState(userId: string, cardId: string): PersonalCardState | undefined {
    return this.stateCache.get(this.getKey(userId, cardId));
  }

  getAllStates(userId: string): PersonalCardState[] {
    const states: PersonalCardState[] = [];
    for (const state of this.stateCache.values()) {
      if (state.userId === userId) {
        states.push(state);
      }
    }
    return states;
  }

  // Update card state: updates memory, fires subscriptions, writes to IDB
  async updateCardState(userId: string, cardId: string, patch: Partial<PersonalCardState>) {
    if (!userId || !cardId) return;

    const cacheKey = this.getKey(userId, cardId);
    const existing = this.stateCache.get(cacheKey) || this.createEmptyState(userId, cardId);
    
    const updated: PersonalCardState = {
      ...existing,
      ...patch,
      updatedAt: Date.now() // Always bump updatedAt on mutation
    };

    this.stateCache.set(cacheKey, updated);
    this.notify(userId, cardId, updated);

    // Persist local SOT
    const storeKey = this.getStoreKey(userId, cardId);
    try {
      await idbSet(storeKey, updated);
    } catch (e) {
      console.warn("CardStateManager: Failed to write to IndexedDB", e);
    }
  }

  // Hydrates states from IDB and runs Read-Only migration from legacy sources if needed
  async hydrateStates(userId: string): Promise<void> {
    if (this.hydratedUsers.has(userId) || this.hydratingUsers.has(userId)) return;
    this.hydratingUsers.add(userId);

    try {
      const allKeys = await idbKeys();
      const stateKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(`vibe_personal_card_states_v1_${userId}_`));
      
      const loadedStates: Record<string, PersonalCardState> = {};

      for (const k of stateKeys) {
        const state = await idbGet<PersonalCardState>(k as string);
        if (state && state.cardId) {
          loadedStates[state.cardId] = state;
          this.stateCache.set(this.getKey(userId, state.cardId), state);
        }
      }

      // Check if we need to run migration (Read Only)
      await this.runMigrationReadOnly(userId, allKeys, loadedStates);

      this.hydratedUsers.add(userId);
    } catch (err) {
      console.error("CardStateManager: Hydration error", err);
    } finally {
      this.hydratingUsers.delete(userId);
    }
  }

  // Legacy Migration - READ ONLY (Idempotent)
  private async runMigrationReadOnly(userId: string, allKeys: IDBValidKey[], existingStates: Record<string, PersonalCardState>) {
    let migratedCount = 0;

    const getSafeState = (cardId: string): PersonalCardState => {
      let state = existingStates[cardId];
      if (!state) {
        state = this.stateCache.get(this.getKey(userId, cardId)) || this.createEmptyState(userId, cardId);
      }
      return state;
    };

    const updateIfNewer = async (cardId: string, legacyState: Partial<PersonalCardState>, legacyUpdatedAt: number) => {
      const current = getSafeState(cardId);
      if (legacyUpdatedAt >= current.updatedAt) {
        const updated = {
          ...current,
          ...legacyState,
          updatedAt: legacyUpdatedAt
        };
        this.stateCache.set(this.getKey(userId, cardId), updated);
        existingStates[cardId] = updated; // keep local ref updated
        await idbSet(this.getStoreKey(userId, cardId), updated);
        migratedCount++;
      }
    };

    // 1. Read vibe_cardstate_* (IDB Legacy Queue)
    const oldQueueKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(`vibe_cardstate_${userId}_`));
    for (const k of oldQueueKeys) {
      try {
        const legacy = await idbGet<any>(k as string);
        if (legacy && legacy.cardId) {
          const ts = legacy.lastUpdatedAt || legacy.updatedAt || 0;
          await updateIfNewer(legacy.cardId, {
            mastery: legacy.mastery,
            isHard: legacy.isWeakCard,
            repetitionCount: legacy.repetitionCount,
            interval: legacy.interval,
            easeFactor: legacy.easeFactor,
            nextReviewDate: legacy.nextReviewDate,
            lastPointAwarded: legacy.lastPointAwarded
          }, ts);
        }
      } catch(e) {}
    }

    // 2. Read Firestore vibe_deckStates
    // We only try to read if navigator.onLine is true or we are in a test environment
    if (typeof navigator !== 'undefined' && navigator.onLine !== false) {
      try {
        const lastSyncKey = `vibe_fs_last_sync_${userId}`;
        const lastSync = (await idbGet<number>(lastSyncKey)) || 0;
        
        const deckStatesCol = collection(db, `users/${userId}/vibe_deckStates`);
        const qDeckStates = lastSync > 0 ? query(deckStatesCol, where("lastUpdatedAt", ">", lastSync)) : deckStatesCol;
        const deckStatesSnap = await fsGetDocs(qDeckStates);
        
        if (deckStatesSnap.empty && lastSync === 0) {
           // Migration from cardsState to vibe_deckStates
           const legacyCol = collection(db, `users/${userId}/cardsState`);
           const { limit } = await import("firebase/firestore");
           const legacySnap = await fsGetDocs(query(legacyCol, limit(500)));
           if (!legacySnap.empty) {
               const statesMap: any = {};
               legacySnap.forEach((d: any) => {
                  const data = d.data();
                  statesMap[d.id] = { cardId: d.id, ...data, updatedAt: data.updatedAt || Date.now() };
               });
               
               const entries = Object.entries(statesMap);
               const CHUNK_SIZE = 1000;
               const { setDoc, doc } = await import("firebase/firestore");
               for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
                  const chunk = entries.slice(i, i + CHUNK_SIZE);
                  const chunkMap = Object.fromEntries(chunk);
                  const chunkDocId = `legacy_migrated_${i / CHUNK_SIZE}`;
                  try {
                    await setDoc(doc(db, `users/${userId}/vibe_deckStates`, chunkDocId), {
                        deckId: chunkDocId,
                        states: chunkMap,
                        lastUpdatedAt: Date.now()
                    });
                  } catch (e) {
                    console.warn("Migration chunk failed:", e);
                  }
               }
               
               for (const [cardId, cloudData] of Object.entries<any>(statesMap)) {
                 const ts = cloudData.updatedAt ? new Date(cloudData.updatedAt).getTime() : 0;
                 if (!isNaN(ts)) {
                   updateIfNewer(cardId, {
                     mastery: cloudData.mastery,
                     isHard: cloudData.isWeakCard,
                     repetitionCount: cloudData.repetitionCount,
                     interval: cloudData.interval,
                     easeFactor: cloudData.easeFactor,
                     nextReviewDate: cloudData.nextReviewDate,
                     lastPointAwarded: cloudData.lastPointAwarded
                   }, ts);
                 }
               }
           }
        } else {
           deckStatesSnap.forEach((docSnap: any) => {
             const cloudData = docSnap.data();
             const deckStates = cloudData.states || {};
             Object.entries(deckStates).forEach(([cardId, stateData]: [string, any]) => {
                const ts = stateData.updatedAt || stateData.lastUpdatedAt || 0;
                if (!isNaN(ts)) {
                  updateIfNewer(cardId, {
                    mastery: stateData.mastery,
                    isHard: stateData.isWeakCard || stateData.isHard,
                    repetitionCount: stateData.repetitionCount,
                    interval: stateData.interval,
                    easeFactor: stateData.easeFactor,
                    nextReviewDate: stateData.nextReviewDate,
                    lastPointAwarded: stateData.lastPointAwarded
                  }, ts);
                }
             });
           });
        }
        
        // Update sync timestamp (minus 5s to prevent edge case missed updates)
        await idbSet(lastSyncKey, Date.now() - 5000);
      } catch(e) {}
    }

    // 3. Read weak_cards_* (LocalStorage) - Lowest priority fallback
    // Only migrate if we don't have a reliable state for it yet
    try {
      if (typeof localStorage !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("weak_cards_")) {
            const weakIds = JSON.parse(localStorage.getItem(key) || "[]");
            for (const cardId of weakIds) {
              const current = getSafeState(cardId);
              // If current state has 0 updatedAt, it means we've never synced it from a reliable source.
              // We apply isHard = true but we DO NOT bump updatedAt, to allow future real syncs to override it.
              if (current.updatedAt === 0 && !current.isHard) {
                const updated = {
                  ...current,
                  isHard: true
                };
                this.stateCache.set(this.getKey(userId, cardId), updated);
                existingStates[cardId] = updated;
                await idbSet(this.getStoreKey(userId, cardId), updated);
                migratedCount++;
              }
            }
          }
        }
      }
    } catch(e) {}

    if (migratedCount > 0) {
      console.log(`[CardStateManager] Migrated ${migratedCount} card states from legacy sources.`);
    }
  }

  private createEmptyState(userId: string, cardId: string): PersonalCardState {
    return {
      cardId,
      userId,
      mastery: 0,
      isHard: false,
      repetitionCount: 0,
      interval: 0,
      easeFactor: 2.5,
      nextReviewDate: 0,
      lastPointAwarded: 0,
      updatedAt: 0
    };
  }

  subscribe(cardId: string, listener: Subscriber) {
    const subs = this.subscribers.get(cardId) || [];
    subs.push(listener);
    this.subscribers.set(cardId, subs);

    return () => {
      const currentSubs = this.subscribers.get(cardId) || [];
      this.subscribers.set(cardId, currentSubs.filter(l => l !== listener));
    };
  }

  private notify(userId: string, cardId: string, state: PersonalCardState) {
    const subs = this.subscribers.get(cardId);
    if (subs) {
      subs.forEach(l => l(cardId, state));
    }
  }
}

export const CardStateManager = new CardStateManagerClass();
