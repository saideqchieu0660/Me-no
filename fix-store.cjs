const fs = require('fs');
let code = fs.readFileSync('src/lib/store.ts', 'utf8');

const target = `        // Hydrate Sets from Firestore
        try {
            const { withTimeout } = await import('./firebase');
            const setsCol = collection(db, "sets");
            let setsSnapshot = await withTimeout(getDocs(setsCol), 6000, { empty: true, forEach: () => {} } as any);`;

const replacement = `        // Hydrate Sets from Firestore
        try {
            const { withTimeout } = await import('./firebase');
            const { query, where, getDoc, doc } = await import('firebase/firestore');
            const setsCol = collection(db, "sets");
            
            // OPTIMIZATION: Only fetch user's own decks to avoid Full Table Scan
            const q = query(setsCol, where("createdBy", "==", u.id));
            let setsSnapshot = await withTimeout(getDocs(q), 6000, { empty: true, forEach: () => {} } as any);`;

code = code.replace(target, replacement);

const target2 = `                setsSnapshot = await getDocs(setsCol);
            }`;

const replacement2 = `                setsSnapshot = await getDocs(q);
            }
            
            // Bổ sung Load riêng các bộ bài của hệ thống (System Decks)
            const systemDecksList = [
              "deck_1", "deck_phil_2", "deck_math_1", "deck_math_2", "deck_physics_1", "deck_physics_2", "deck_test_ui", "deck_formatting_test", "deck_test_50"
            ];
            const extraSystemDecks = [];
            for (const sysId of systemDecksList) {
               try {
                  const docSnap = await getDoc(doc(db, "sets", sysId));
                  if (docSnap.exists()) extraSystemDecks.push(docSnap.data());
               } catch(e) {}
            }`;
            
code = code.replace(target2, replacement2);

const target3 = `                // Personal decks should only be loaded/visible if system deck, created by self, creator is admin/teacher, or logged-in user is admin/teacher.
                if (isSystem || isCreatedBySelf || isUserTeacher || isCreatedByTeacher) {
                  fbDecks.push(deckData as Deck);
                }
            });`;

const replacement3 = `                // Personal decks should only be loaded/visible if system deck, created by self, creator is admin/teacher, or logged-in user is admin/teacher.
                if (isSystem || isCreatedBySelf || isUserTeacher || isCreatedByTeacher) {
                  fbDecks.push(deckData as Deck);
                }
            });
            
            // Append system decks that were fetched separately
            extraSystemDecks.forEach(deckData => {
                if (deckData && Array.isArray(deckData.cards)) {
                    deckData.cards = deckData.cards.map((c: any) => ({
                        ...c,
                        mastery: (typeof c.mastery === 'number' && !isNaN(c.mastery)) ? c.mastery : 0
                    }));
                }
                if (!fbDecks.find(d => d.id === deckData.id)) {
                   fbDecks.push(deckData as Deck);
                }
            });`;

code = code.replace(target3, replacement3);

fs.writeFileSync('src/lib/store.ts', code);
console.log("Fixed store.ts");
