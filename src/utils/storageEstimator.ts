export async function getStorageEstimate() {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      return {
        quota: estimate.quota || 0,
        usage: estimate.usage || 0,
        available: true
      };
    } catch (e) {
      console.warn("navigator.storage.estimate failed:", e);
      return { quota: 0, usage: 0, available: false };
    }
  }
  return { quota: 0, usage: 0, available: false };
}
