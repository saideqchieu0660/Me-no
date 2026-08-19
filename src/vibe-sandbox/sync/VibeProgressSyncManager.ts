import { db } from "../../lib/firebase";
import { doc, getDoc, setDoc, collection, getDocs, writeBatch, onSnapshot } from "firebase/firestore";

export interface DeckProgress {
  deckId: string;
  currentIndex: number;
  sessionCorrectCount: number;
  sessionMasteryGained: number;
  sessionTimeSpent: number;
  updatedAt: number;
  historyLength: number; // to verify size without pushing full array if we don't want to
}

export class VibeProgressSyncManager {
  private static unsubscribers: (() => void)[] = [];
  private static currentSyncUid: string | null = null;

  static startRealtimeSync(userId: string) {
    if (this.currentSyncUid === userId && this.unsubscribers.length > 0) {
      return; // Already listening
    }
    
    this.stopRealtimeSync();
    this.currentSyncUid = userId;

    const { query, orderBy, limit } = require("firebase/firestore");
    const colRef = collection(db, `users/${userId}/studyProgress`);
    // Only listen to the 50 most recently updated decks
    const q = query(colRef, orderBy("updatedAt", "desc"), limit(50));
    const unsub = onSnapshot(q, (snapshot) => {
      let hasChanges = false;
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added" || change.type === "modified") {
          const cloudData = change.doc.data() as DeckProgress;
          const deckId = change.doc.id;
          cloudData.deckId = deckId;

          const localData = this.getLocalProgress(userId, deckId);
          if (!localData || (cloudData.updatedAt && cloudData.updatedAt > localData.updatedAt)) {
             this.setLocalProgress(userId, deckId, cloudData);
             hasChanges = true;
          }
        }
      });
      
      if (hasChanges) {
        window.dispatchEvent(new CustomEvent("vibe-progress-synced"));
      }
    });
    this.unsubscribers.push(unsub);
  }

  static stopRealtimeSync() {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    this.currentSyncUid = null;
  }

  /**
   * Reads the current local progress for a deck from localStorage.
   */
  static getLocalProgress(userId: string, deckId: string): DeckProgress | null {
    const progressKey = `study_progress_${userId}_${deckId}`;
    const sessionKey = `study_session_data_${userId}_${deckId}`;
    
    const currentIndexRaw = localStorage.getItem(progressKey);
    if (!currentIndexRaw) return null;
    
    const currentIndex = parseInt(currentIndexRaw, 10);
    if (isNaN(currentIndex)) return null;

    let sessionCorrectCount = 0;
    let sessionMasteryGained = 0;
    let sessionTimeSpent = 0;
    let historyLength = 0;

    try {
      const sessionDataRaw = localStorage.getItem(sessionKey);
      if (sessionDataRaw) {
        const sessionData = JSON.parse(sessionDataRaw);
        sessionCorrectCount = sessionData.correctCount || 0;
        sessionMasteryGained = sessionData.masteryGained || 0;
        sessionTimeSpent = sessionData.timeSpent || 0;
        historyLength = Array.isArray(sessionData.history) ? sessionData.history.length : 0;
      }
    } catch (e) {
      console.warn("Failed to parse session data for", deckId);
    }

    // We use a separate key to track the local updatedAt. If it doesn't exist, we assume it's right now.
    const updatedAtKey = `study_progress_updatedAt_${userId}_${deckId}`;
    const updatedAtRaw = localStorage.getItem(updatedAtKey);
    const updatedAt = updatedAtRaw ? parseInt(updatedAtRaw, 10) : Date.now();

    return {
      deckId,
      currentIndex,
      sessionCorrectCount,
      sessionMasteryGained,
      sessionTimeSpent,
      historyLength,
      updatedAt
    };
  }

  /**
   * Sets the local progress. Overwrites localStorage.
   */
  static setLocalProgress(userId: string, deckId: string, progress: DeckProgress) {
    const progressKey = `study_progress_${userId}_${deckId}`;
    const sessionKey = `study_session_data_${userId}_${deckId}`;
    const updatedAtKey = `study_progress_updatedAt_${userId}_${deckId}`;

    localStorage.setItem(progressKey, progress.currentIndex.toString());
    localStorage.setItem(updatedAtKey, progress.updatedAt.toString());

    try {
      // For session data, if we pull, we just overwrite the counters. We leave history empty as it might be too heavy to sync.
      localStorage.setItem(sessionKey, JSON.stringify({
        correctCount: progress.sessionCorrectCount,
        masteryGained: progress.sessionMasteryGained,
        timeSpent: progress.sessionTimeSpent,
        history: [] // We don't sync full history over cloud to save space
      }));
    } catch (e) {
      console.error("Failed to set local progress", e);
    }
  }

  /**
   * Marks a local update timestamp whenever progress changes.
   */
  static markLocalUpdate(userId: string, deckId: string) {
    const updatedAtKey = `study_progress_updatedAt_${userId}_${deckId}`;
    localStorage.setItem(updatedAtKey, Date.now().toString());
  }

  /**
   * Push progress of a specific deck to Firebase.
   */
  /**
   * Sync full session history and progress when user exits study room.
   */
  static async finishAndSyncSession(userId: string, deckId: string) {
    const local = this.getLocalProgress(userId, deckId);
    if (!local) return false;
    try {
      const sessionDataRaw = localStorage.getItem(`study_session_data_${userId}_${deckId}`);
      let history = [];
      if (sessionDataRaw) {
        try {
          history = JSON.parse(sessionDataRaw).history || [];
        } catch(e){}
      }
      const docRef = doc(db, `users/${userId}/studyProgress/${deckId}`);
      await setDoc(docRef, {
        currentIndex: local.currentIndex,
        sessionCorrectCount: local.sessionCorrectCount,
        sessionMasteryGained: local.sessionMasteryGained,
        sessionTimeSpent: local.sessionTimeSpent,
        history: history,
        updatedAt: local.updatedAt 
      }, { merge: true });
      
      // Clear history to save space
      try {
        localStorage.setItem(`study_session_data_${userId}_${deckId}`, JSON.stringify({
          correctCount: local.sessionCorrectCount,
          masteryGained: local.sessionMasteryGained,
          timeSpent: local.sessionTimeSpent,
          history: []
        }));
      } catch (e) {}
      
      return true;
    } catch (e) {
      console.error("Failed to sync session history", e);
      return false;
    }
  }

  static async pushProgressToCloud(userId: string, deckId: string): Promise<boolean> {
    const local = this.getLocalProgress(userId, deckId);
    if (!local) return false;

    try {
      const docRef = doc(db, `users/${userId}/studyProgress/${deckId}`);
      await setDoc(docRef, {
        currentIndex: local.currentIndex,
        sessionCorrectCount: local.sessionCorrectCount,
        sessionMasteryGained: local.sessionMasteryGained,
        sessionTimeSpent: local.sessionTimeSpent,
        updatedAt: local.updatedAt // Push the exact time we modified it locally
      }, { merge: true });
      return true;
    } catch (e) {
      console.error("Failed to push progress", e);
      return false;
    }
  }

  /**
   * Pull progress of a specific deck from Firebase to Local.
   * Prompts user or handles safety. Returns true if pulled and updated.
   */
  static async pullProgressFromCloud(userId: string, deckId: string, force: boolean = false): Promise<boolean> {
    try {
      const docRef = doc(db, `users/${userId}/studyProgress/${deckId}`);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return false;

      const cloudData = snap.data() as DeckProgress;
      if (!cloudData.updatedAt) return false;

      const localData = this.getLocalProgress(userId, deckId);
      
      // If force is true, we overwrite regardless of timestamps.
      // Otherwise, only overwrite if Cloud is newer.
      if (!force && localData && localData.updatedAt >= cloudData.updatedAt) {
        return false; // Local is already newer or same
      }

      cloudData.deckId = deckId;
      this.setLocalProgress(userId, deckId, cloudData);
      return true;
    } catch (e) {
      console.error("Failed to pull progress", e);
      return false;
    }
  }

  /**
   * Syncs ALL decks based on Timestamp.
   */
  static async syncAllSmart(userId: string, onProgress?: (msg: string) => void): Promise<{ pulled: number, pushed: number }> {
    if (onProgress) onProgress("Đang kết nối mây...");
    let pulledCount = 0;
    let pushedCount = 0;

    try {
      // 1. Fetch cloud progress (limited to prevent unbounded reads)
      const { query, orderBy, limit } = require("firebase/firestore");
      const colRef = collection(db, `users/${userId}/studyProgress`);
      const q = query(colRef, orderBy("updatedAt", "desc"), limit(200));
      const snaps = await getDocs(q);
      const cloudMap = new Map<string, DeckProgress>();
      snaps.forEach(doc => {
        cloudMap.set(doc.id, doc.data() as DeckProgress);
      });

      // 2. Scan all local storage to find local progress
      // Keys: study_progress_{userId}_{deckId}
      const prefix = `study_progress_${userId}_`;
      const localDecks = new Set<string>();
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix) && !key.includes("updatedAt")) {
          const deckId = key.replace(prefix, "");
          localDecks.add(deckId);
        }
      }

      // We will batch writes to save quota
      const batch = writeBatch(db);
      let batchOps = 0;

      // 3. Resolve Delta
      const allDecks = new Set([...Array.from(localDecks), ...Array.from(cloudMap.keys())]);
      
      for (const deckId of allDecks) {
        const cloudData = cloudMap.get(deckId);
        const localData = this.getLocalProgress(userId, deckId);

        if (cloudData && !localData) {
          // Exists on cloud, not local -> Pull
          cloudData.deckId = deckId;
          this.setLocalProgress(userId, deckId, cloudData);
          pulledCount++;
        } else if (localData && !cloudData) {
          // Exists local, not cloud -> Push
          const docRef = doc(db, `users/${userId}/studyProgress/${deckId}`);
          batch.set(docRef, {
            currentIndex: localData.currentIndex,
            sessionCorrectCount: localData.sessionCorrectCount,
            sessionMasteryGained: localData.sessionMasteryGained,
            sessionTimeSpent: localData.sessionTimeSpent,
            updatedAt: localData.updatedAt
          }, { merge: true });
          batchOps++;
          pushedCount++;
        } else if (localData && cloudData) {
          // Exists on both -> Compare Timestamp
          if (localData.updatedAt > cloudData.updatedAt) {
            // Push
            const docRef = doc(db, `users/${userId}/studyProgress/${deckId}`);
            batch.set(docRef, {
              currentIndex: localData.currentIndex,
              sessionCorrectCount: localData.sessionCorrectCount,
              sessionMasteryGained: localData.sessionMasteryGained,
              sessionTimeSpent: localData.sessionTimeSpent,
              updatedAt: localData.updatedAt
            }, { merge: true });
            batchOps++;
            pushedCount++;
          } else if (cloudData.updatedAt > localData.updatedAt) {
            // Pull
            cloudData.deckId = deckId;
            this.setLocalProgress(userId, deckId, cloudData);
            pulledCount++;
          }
        }
      }

      // 4. Commit Push Batch
      if (batchOps > 0) {
        if (onProgress) onProgress(`Đang đẩy ${batchOps} bộ bài lên mây...`);
        await batch.commit();
      }

      return { pulled: pulledCount, pushed: pushedCount };

    } catch (e) {
      console.error("Smart Sync Failed", e);
      throw e;
    }
  }

  /**
   * Forced Full Push for "Pull" button in settings. 
   * It takes everything on the cloud and overwrites local, ignoring local timestamps.
   */
  static async forcePullAll(userId: string): Promise<number> {
    const { query, orderBy, limit } = require("firebase/firestore");
    const colRef = collection(db, `users/${userId}/studyProgress`);
    const q = query(colRef, orderBy("updatedAt", "desc"), limit(200));
    const snaps = await getDocs(q);
    let count = 0;
    snaps.forEach(snap => {
      const cloudData = snap.data() as DeckProgress;
      cloudData.deckId = snap.id;
      this.setLocalProgress(userId, snap.id, cloudData);
      count++;
    });
    return count;
  }
}
