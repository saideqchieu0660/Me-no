import { get, set, keys, del } from 'idb-keyval';

interface StoredItem<T> {
  value: T;
  timestamp: number;
}

export const safeIdb = {
  /**
   * Safe getter that won't throw unhandled exceptions
   */
  async get<T>(key: string): Promise<T | undefined> {
    try {
      const item = await get<StoredItem<T>>(key);
      return item ? item.value : undefined;
    } catch (e) {
      console.warn(`[safeIdb] Failed to get key ${key}:`, e);
      return undefined;
    }
  },

  /**
   * Safe setter with QuotaExceededError protection and auto-eviction
   */
  async set<T>(key: string, value: T): Promise<void> {
    const item: StoredItem<T> = { value, timestamp: Date.now() };
    
    try {
      await set(key, item);
    } catch (e: any) {
      if (e.name === 'QuotaExceededError' || (e.message && e.message.includes('Quota'))) {
        console.warn('[safeIdb] Quota exceeded. Attempting to clear oldest items...');
        await this.clearOldest();
        
        // Retry saving after clearing
        try {
           await set(key, item);
        } catch (retryError) {
           console.error('[safeIdb] Still failing after clearing space:', retryError);
        }
      } else {
        console.error(`[safeIdb] Failed to set key ${key}:`, e);
      }
    }
  },

  /**
   * Safe delete wrapper
   */
  async del(key: string): Promise<void> {
    try {
      await del(key);
    } catch (e) {
      console.warn(`[safeIdb] Failed to delete key ${key}:`, e);
    }
  },
  
  /**
   * Read raw entries from the store
   */
  async getRawItems(): Promise<Array<{key: IDBValidKey, timestamp: number}>> {
      try {
        const allKeys = await keys();
        const itemsWithTime = [];
        
        for (const k of allKeys) {
          try {
            const item = await get<StoredItem<any>>(k);
            if (item && typeof item === 'object' && 'timestamp' in item) {
              itemsWithTime.push({ key: k, timestamp: item.timestamp });
            } else {
               // Legacy unformatted item
               itemsWithTime.push({ key: k, timestamp: 0 });
            }
          } catch (e) {
              // Ignore corrupted entries
          }
        }
        return itemsWithTime;
      } catch (e) {
        console.error('[safeIdb] Failed to get raw items:', e);
        return [];
      }
  },

  /**
   * Clears oldest entries to free up space
   */
  async clearOldest(itemsToRemove = 5): Promise<void> {
    try {
      const itemsWithTime = await this.getRawItems();
      
      // Sort by oldest first (lowest timestamp)
      itemsWithTime.sort((a, b) => a.timestamp - b.timestamp);
      
      // Delete the oldest N items
      const keysToDelete = itemsWithTime.slice(0, itemsToRemove).map(i => i.key);
      for (const k of keysToDelete) {
        await del(k);
        console.log(`[safeIdb] Evicted old key to free up storage: ${k}`);
      }
    } catch (e) {
      console.error('[safeIdb] Failed to clear oldest items:', e);
    }
  }
};
