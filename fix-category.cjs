const fs = require('fs');
let code = fs.readFileSync('src/pages/CategoryView.tsx', 'utf8');

const target = `    const q = query(collection(db, "sets"));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      let allDecks: Deck[] = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Deck));
      
      // Merge with offline decks in case Firestore cache is empty while offline
      try {
         const { getAllOfflineDecks } = await import('../utils/offlineDb');
         const offlineDecks = await getAllOfflineDecks();
         offlineDecks.forEach(offDeck => {
            if (!allDecks.some(d => d.id === offDeck.id)) {
               allDecks.push(offDeck);
            }
         });
      } catch (e) {
         console.warn("Failed to merge offline decks in CategoryView:", e);
      }
      
      const targetCategory = decodedCategory.trim().toUpperCase();
      const filtered = allDecks.filter(d => String(d.subject || "Khác").trim().toUpperCase() === targetCategory);
      setDecks(filtered);
      setLoading(false);
    }, async (error) => {
      console.error("Error fetching decks snapshot:", error);
      // Fallback aggressively to offline DB on error
      try {
         const { getAllOfflineDecks } = await import('../utils/offlineDb');
         const offlineDecks = await getAllOfflineDecks();
         const targetCategory = decodedCategory.trim().toUpperCase();
         const filtered = offlineDecks.filter(d => String(d.subject || "Khác").trim().toUpperCase() === targetCategory);
         setDecks(filtered);
      } catch (e) {
         console.warn("Complete failure to load category:", e);
      }
      
      toast.error("Đang dùng dữ liệu ngoại tuyến hoặc lỗi tải danh mục");
      setLoading(false);
    });

    return () => unsubscribe();`;

const replacement = `    // OPTIMIZATION: Avoid full table scan by using locally cached decks from store
    const fetchLocalDecks = async () => {
      try {
         let allDecks = [...store.getDecks()];
         
         const { getAllOfflineDecks } = await import('../utils/offlineDb');
         const offlineDecks = await getAllOfflineDecks();
         offlineDecks.forEach(offDeck => {
            if (!allDecks.some(d => d.id === offDeck.id)) {
               allDecks.push(offDeck);
            }
         });
         
         const targetCategory = decodedCategory.trim().toUpperCase();
         const filtered = allDecks.filter(d => String(d.subject || "Khác").trim().toUpperCase() === targetCategory);
         setDecks(filtered);
      } catch (e) {
         console.warn("Complete failure to load category:", e);
      } finally {
         setLoading(false);
      }
    };
    
    fetchLocalDecks();
    
    // Listen to changes from store instead of Firestore to save reads
    const handleStoreChange = () => fetchLocalDecks();
    window.addEventListener("henosis-data-synced", handleStoreChange);
    return () => window.removeEventListener("henosis-data-synced", handleStoreChange);`;

code = code.replace(target, replacement);
fs.writeFileSync('src/pages/CategoryView.tsx', code);
console.log("Fixed CategoryView.tsx");
