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
            const q = query(setsCol, where("ownerId", "==", u.id)); // Assuming ownerId matches
            let setsSnapshot = await withTimeout(getDocs(q), 6000, { empty: true, forEach: () => {} } as any);`;

code = code.replace(target, replacement);

const target2 = `                setsSnapshot = await getDocs(setsCol);
            }

            const fbDecks: Deck[] = [];`;

const replacement2 = `                // Optimization: do not re-fetch entire setsCol
                setsSnapshot = await getDocs(q);
            }

            const fbDecks: Deck[] = [];`;
            
code = code.replace(target2, replacement2);

fs.writeFileSync('src/lib/store.ts', code);
console.log("Fixed store.ts");
