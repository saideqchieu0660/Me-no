import { get, set, keys } from "idb-keyval";
import { db } from "../../lib/firebase";
import { collection, doc, getDocs, getDoc, writeBatch, query, where } from "firebase/firestore";
import { store } from "../../lib/store";
import { auth } from "../../lib/firebase";

export async function forceMergeRescue(): Promise<string> {
  const user = store.getCurrentUser() || auth.currentUser;
  if (!user) throw new Error("No authenticated user.");
  const uid = typeof user === 'string' ? user : (user as any).uid || (user as any).id;
  if (!uid) throw new Error("Could not determine user ID.");

  const log: string[] = [];
  log.push("Bắt đầu quy trình Force Merge LWW (Last-Write-Wins)...");

  try {
    // 1. GOM LOCAL DATA
    log.push("Đang thu thập dữ liệu Local (IndexedDB)...");
    const allLocalKeys = await keys();
    const localDecks: Record<string, any> = {};
    const localCardStates: Record<string, any> = {};
    let localProfile: any = null;

    for (const key of allLocalKeys as string[]) {
      if (key.startsWith("vibe_deck_")) {
        localDecks[key.replace("vibe_deck_", "")] = await get(key);
      } else if (key.startsWith(`vibe_cardstate_${uid}_`)) {
        localCardStates[key.replace(`vibe_cardstate_${uid}_`, "")] = await get(key);
      } else if (key === `vibe_profile_${uid}`) {
        localProfile = await get(key);
      }
    }

    // 2. GOM CLOUD DATA
    log.push("Đang tải dữ liệu từ Cloud (Firestore)...");
    const cloudDecks: Record<string, any> = {};
    const qDecks = query(collection(db, "vibe_decks"), where("ownerId", "==", uid));
    const cloudDecksSnap = await getDocs(qDecks);
    cloudDecksSnap.forEach(d => {
       cloudDecks[d.id] = { id: d.id, ...d.data() };
    });

    let cloudProfile: any = null;
    const pDoc = await getDoc(doc(db, "users", uid));
    if (pDoc.exists()) cloudProfile = pDoc.data();

    const cloudCardStates: Record<string, any> = {};
    const cStatesSnap = await getDocs(collection(db, "users", uid, "cardsState"));
    cStatesSnap.forEach(d => {
      cloudCardStates[d.id] = { cardId: d.id, ...d.data() };
    });

    // 3. MERGE THE TRUTH
    log.push("Tiến hành gộp dữ liệu...");
    const mergedDecks: Record<string, any> = {};
    const allDeckIds = new Set([...Object.keys(localDecks), ...Object.keys(cloudDecks)]);
    for (const dId of allDeckIds) {
      const local = localDecks[dId];
      const cloud = cloudDecks[dId];
      
      if (local && cloud) {
        const localTime = local.lastUpdatedAt || 0;
        const cloudTime = cloud.lastUpdatedAt || 0;
        // Ưu tiên bản nào mới hơn
        mergedDecks[dId] = localTime > cloudTime ? local : cloud;
      } else {
        mergedDecks[dId] = local || cloud;
      }
    }

    const mergedCardStates: Record<string, any> = {};
    const allCardStateIds = new Set([...Object.keys(localCardStates), ...Object.keys(cloudCardStates)]);
    for (const cId of allCardStateIds) {
      const local = localCardStates[cId];
      const cloud = cloudCardStates[cId];
      
      if (local && cloud) {
        const localTime = local.updatedAt || local.lastUpdatedAt || 0;
        const cloudTime = cloud.updatedAt || cloud.lastUpdatedAt || 0;
        
        // Nếu bằng nhau hoặc không rõ, so sánh điểm Mastery
        if (localTime === cloudTime) {
           const localM = local.mastery || 0;
           const cloudM = cloud.mastery || 0;
           mergedCardStates[cId] = localM > cloudM ? local : cloud;
        } else {
           mergedCardStates[cId] = localTime > cloudTime ? local : cloud;
        }
      } else {
        mergedCardStates[cId] = local || cloud;
      }
    }

    let mergedProfile = cloudProfile || {};
    if (localProfile) {
      const localTime = localProfile.lastUpdatedAt || 0;
      const cloudTime = cloudProfile?.lastUpdatedAt || 0;
      if (localTime > cloudTime) {
         mergedProfile = { ...cloudProfile, ...localProfile };
      } else {
         mergedProfile = { ...localProfile, ...cloudProfile };
      }
    }

    // 4. LƯU LẠI MASTER DATA XUỐNG LOCAL VÀ ĐẨY LÊN CLOUD
    log.push("Đang đồng bộ bản Master lên Cloud và Local...");
    
    // Đẩy Local
    for (const [dId, deck] of Object.entries(mergedDecks)) {
      await set(`vibe_deck_${dId}`, deck);
    }
    for (const [cId, state] of Object.entries(mergedCardStates)) {
      await set(`vibe_cardstate_${uid}_${cId}`, state);
      // Ghi qua CardStateManager
      try {
         const { CardStateManager } = await import("../../lib/CardStateManager");
         await CardStateManager.updateCardState(uid, cId, state);
      } catch (e) {
         // ignore
      }
    }
    if (Object.keys(mergedProfile).length > 0) {
      await set(`vibe_profile_${uid}`, mergedProfile);
    }

    // Đẩy Cloud (Dùng Batch)
    const batch = writeBatch(db);
    let batchCount = 0;
    
    for (const [dId, deck] of Object.entries(mergedDecks)) {
       const ref = doc(db, "vibe_decks", dId);
       batch.set(ref, deck, { merge: true });
       batchCount++;
    }

    const pRef = doc(db, "users", uid);
    batch.set(pRef, mergedProfile, { merge: true });
    batchCount++;

    for (const [cId, state] of Object.entries(mergedCardStates)) {
       const ref = doc(db, "users", uid, "cardsState", cId);
       batch.set(ref, state, { merge: true });
       batchCount++;
       if (batchCount >= 450) { // Firestore limit là 500
          await batch.commit();
          batchCount = 0;
       }
    }
    
    if (batchCount > 0) {
       await batch.commit();
    }

    log.push("Hoàn tất Force Merge! Tải lại trang để áp dụng.");
    return log.join('\n');
  } catch (error: any) {
    console.error("Force Merge Error", error);
    log.push("LỖI: " + error.message);
    return log.join('\n');
  }
}
