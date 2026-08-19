import { get, set, del, keys } from "idb-keyval";
import { db, dbService } from "./firebase";
import { collection, doc, getDoc, getDocs, query, where, setDoc, writeBatch } from "firebase/firestore";
import { store, Deck, User } from "./store";

const SYNC_QUEUE_KEY = "offline_sync_queue_v2";

export interface SyncAction {
  id: string;
  type: "UPSERT_DECK" | "DELETE_DECK" | "UPSERT_PROFILE";
  payload: any;
  timestamp: number;
}

export const SyncEngine = {
  // Sync state
  isSyncing: false,
  
  // Get sync queue
  async getQueue(): Promise<SyncAction[]> {
    return (await get<SyncAction[]>(SYNC_QUEUE_KEY)) || [];
  },

  // Save sync queue
  async setQueue(queue: SyncAction[]) {
    await set(SYNC_QUEUE_KEY, queue);
  },

  // Enqueue a local change to be synced to Firestore later
  async enqueueChange(action: Omit<SyncAction, "id" | "timestamp">) {
    const queue = await this.getQueue();
    queue.push({
      ...action,
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2,9)}`,
      timestamp: Date.now()
    });
    await this.setQueue(queue);
    
    // Trigger sync if online
    if (navigator.onLine) {
      this.syncNow();
    }
  },

  // Trigger sync process
  async syncNow() {
    if (this.isSyncing || !navigator.onLine) return;
    this.isSyncing = true;
    
    try {
      let queue = await this.getQueue();
      if (queue.length === 0) {
         // Even if nothing to push, we can pull new changes
         await this.pullFromFirestore();
         this.isSyncing = false;
         return;
      }

      // Batch Push to Firestore
      const batch = writeBatch(db);
      for (const item of queue) {
        if (item.type === "UPSERT_DECK") {
          const deckRef = doc(db, "decks", item.payload.id);
          batch.set(deckRef, item.payload, { merge: true });
        } else if (item.type === "DELETE_DECK") {
          const deckRef = doc(db, "decks", item.payload.id);
          batch.delete(deckRef);
        } else if (item.type === "UPSERT_PROFILE") {
          const profileRef = doc(db, "users", item.payload.id);
          batch.set(profileRef, item.payload, { merge: true });
        }
      }
      
      await batch.commit();
      
      // Clear queue
      await this.setQueue([]);
      
      // Pull changes down
      await this.pullFromFirestore();

    } catch (e) {
      console.error("[SyncEngine] Sync failed:", e);
    } finally {
      this.isSyncing = false;
    }
  },

  // Pull latest data from Firestore and save to IndexedDB
  async pullFromFirestore() {
    const user = store.getCurrentUser();
    if (!user) return;
    
    try {
      // 1. Pull Decks
      const q = query(collection(db, "decks"), where("ownerId", "==", user.id));
      const snap = await getDocs(q);
      const remoteDecks: Deck[] = [];
      snap.forEach(d => remoteDecks.push({ id: d.id, ...d.data() } as Deck));
      
      // Merge with IndexedDB 
      // Simple strategy: Firestore overwrites local for now.
      for (const deck of remoteDecks) {
        await set(`deck_${deck.id}`, deck);
      }
      
      // 2. Notify UI
      window.dispatchEvent(new CustomEvent("sync-engine-pulled"));
      
    } catch (e) {
      console.error("[SyncEngine] Pull failed:", e);
    }
  },

  // Local CRUD operations (UI uses these directly)
  async getLocalDecks(): Promise<Deck[]> {
    const allKeys = await keys();
    const deckKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith("deck_"));
    const localDecks: Deck[] = [];
    for (const k of deckKeys) {
      const d = await get(k as string);
      if (d) localDecks.push(d as Deck);
    }
    return localDecks;
  },

  async saveDeck(deck: Deck) {
    await set(`deck_${deck.id}`, deck);
    await this.enqueueChange({ type: "UPSERT_DECK", payload: deck });
    window.dispatchEvent(new CustomEvent("sync-engine-pulled"));
  },

  async deleteDeck(deckId: string) {
    await del(`deck_${deckId}`);
    await this.enqueueChange({ type: "DELETE_DECK", payload: { id: deckId } });
    window.dispatchEvent(new CustomEvent("sync-engine-pulled"));
  }
};

// Auto start
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    setTimeout(() => SyncEngine.syncNow(), 1000);
  });
}
